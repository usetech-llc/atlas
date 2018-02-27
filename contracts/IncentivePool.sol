pragma solidity ^0.4.16;
import "./IncentiveCurveTable.sol";
import "./Relay.sol";
import "./AccessToken.sol";
import "./IncentivePoolInterface.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract IncentivePool is IncentivePoolInterface {
	using SafeMath for uint256;

	/*** FIELDS ***/
	Relay public relay; // CHANGE

	// Token information
	AccessToken private token;

	// parameters
	uint256 public deterministicCap = 162 * 10**7; // Will be multiplied by 10^decimals
	IncentiveCurveTable private curveTb;

	// time periods
	uint256 public constant seconds_in_one_year = 31557600;
	uint256 public constant deterministic_minting_period = 10 * seconds_in_one_year;
	uint256 public constant ETH_unlocking_period = 5 * seconds_in_one_year;

	// timestamps
	uint256 public genesis;
	uint256 public last_ETH_update;

	// ACX Balances
	uint256 public ACX_minted;   // cumulative ACX minted
	uint256 public ACX_balance;  // ACX_minted minus ACX distributed

	// ETH Balances
	uint256 public constant ETH_total = 6000 * 10**18; // Total ETH that will be incentivised
	uint256 public ETH_unlocked; // cumulative ETH unlocked
	uint256 public ETH_balance;  // ETH_unlocked minus ETH distributed (does not equal this.balance)

	mapping (address => uint256) public ACX_allocations;
	mapping (address => uint256) public ETH_allocations;

	// Data model around inflation:
	//
	// inflation_rate is expressed in wei-tokens (tokens multiplied by 10^decimals) per year
	//
	// Inflation can be broken down in three time stages:
	//
	//   1. Until the inflation starts (for timestamps before inflation_timestamp[0]), it is zero
	//   2. Inflation for inflation_timestamp[i] <= timestamp < inflation_timestamp[i+1] is inflation_rate[i]
	//   3. Inflation for last value in inflation_timestamp <= timestamp is last value in inflation_rate
	uint256[] public inflation_rate;
	uint256[] public inflation_timestamp; // Inflation period beginning timestamps
	uint256 public constant inflation_period = seconds_in_one_year;
	uint256 public last_inflation_update;
	uint256 public inflation_support;
	mapping (address => bool) public inflation_votes;

	/*** MODIFIERS ***/

	/**
	* Modifier: only DM & G contracts can request reward allocations
	*
	*/
	modifier onlyController() {
		require(relay.decision_module() == msg.sender || relay.governance() == msg.sender);
		_;
	}

	/*** FUNCTIONS ***/

	/**
	* Constructor. Creates contract and initializes timestamps and balances
	*
	* @param _relayAddress - address of relay contract
	* @param _tokenAddress - ACX token address
	*/
	function IncentivePool(address _relayAddress, address _tokenAddress) public {
		require(_relayAddress != address(0));

		relay = Relay(_relayAddress);
		token = AccessToken(_tokenAddress);
		genesis = now;
		last_ETH_update = now;
		curveTb = new IncentiveCurveTable();

		uint256 decimals = token.decimals();
		deterministicCap = deterministicCap.mul(10 ** decimals);
	}

	/**
    *  Default method
    *
    *  Receive all ETH that is sent to this contract from any address
    */
    function () external payable {
    }

	// Following the "Withdrawal from Contracts" pattern (https://solidity.readthedocs.io/en/latest/common-patterns.html#withdrawal-from-contracts)
	function allocateACX(uint payout, address recipient) external onlyController {
		mintACX();

		if (ACX_balance >= payout) {
			ACX_allocations[recipient] += payout;
			ACX_balance -= payout;
		} else {
			revert();
		}
	}

	function allocateETH(uint payout, address recipient) external onlyController {
		unlockETH();

		require(ETH_balance >= payout);

		ETH_allocations[recipient] += payout;
		ETH_balance -= payout;
	}

	function claimACX() external {
		uint256 payout = ACX_allocations[msg.sender];
		ACX_allocations[msg.sender] = 0; // update sender's ACX allocation to 0

		// transfer ACX to sender
		if (!token.transfer(msg.sender, payout)) {
			revert();
		}
	}

	function claimETH() external {
		uint payout = ETH_allocations[msg.sender];
		require(this.balance >= payout);

		ETH_allocations[msg.sender] = 0; // update sender's ETH allocation to 0

		// transfer ETH to sender
		msg.sender.transfer(payout);
	}

	/**
	*  Get piecewise linear interpolation for curve value for
	*  a given timestamp from genesis
	*
	*  Returned value is between 0 and maxCap
	*
	*
	* @param _timestamp - seconds from genesis
	* @return curve value
	*/
	function getCurveValue(uint256 _timestamp) internal constant returns (uint256) {
		// Determine data points that surround this timestamp
		uint256 timeVal = _timestamp - genesis;
		uint256 step = curveTb.timeStep();
		uint256 dataLen = curveTb.dataLen();
		uint256 curveCap = curveTb.curveCap();
		uint256 p1 = uint256(timeVal / step);
		uint256 p2 = p1 + 1;

		// Interpolate linearly value at timestamp
		if (p2 >= dataLen) {
			return deterministicCap;
		} else {
			uint256 v1 = curveTb.curveData(p1);
			uint256 v2 = curveTb.curveData(p2);
			uint256 retVal = deterministicCap * (v2 * (timeVal - step * p1) + v1 * (step * p2 - timeVal));
			retVal /= step;
			retVal /= curveCap;
			return retVal;
		}
	}

	/**
	* Get total amount that should be minted by a timestamp. This function is
	* deterministic for past timestamps and may change for future because
	* of changes in inflation rate.
	*
	* @param timeStamp - Time in seconds from unix epoch to calculate minted ACX for
	* @return mintedTokenAmount expressed in wei-tokens (multiplied by 10^decimals)
	*/
	function getMintedAmountForTimestamp(uint256 timeStamp) internal constant returns (uint256 mintedTokenAmount) {
		// Calculate delta based on current time
		if (timeStamp < genesis + deterministic_minting_period) {
			// update according to curve
			mintedTokenAmount = getCurveValue(timeStamp);
		}
		else {
			// update according to curve - value at the end of deterministic period
			uint256 balanceDeterministicEnd = deterministicCap;

			// update according to dynamic rate
			uint256 inflationPeriods = inflation_timestamp.length;

			// Absolute number of tokens added due to inflation
			uint256 inflationVolume = 0;

			// Iterate over closed inflation periods
			for (uint16 i=0; i<inflationPeriods; i++) {
				uint256 lengthOfPeriod = 0;

				// Consider last (open) inflation period from last updateInflation call until now
				if (i == inflationPeriods-1) {
					lengthOfPeriod = timeStamp - inflation_timestamp[i];
				} else {
					lengthOfPeriod = inflation_timestamp[i+1] - inflation_timestamp[i];
				}

				uint256 periodInflationVolume = inflation_rate[i].mul(lengthOfPeriod).div(seconds_in_one_year);
				inflationVolume = inflationVolume.add(periodInflationVolume);
			}

			// mintedTokenAmount is the sum of minted tokens at the end of deterministic period
			// and the dynamic inflation volume from the end of deterministic period until now
			mintedTokenAmount = balanceDeterministicEnd.add(inflationVolume);
		}

		return mintedTokenAmount;
	}

	// updates ACX supply every time rewards are allocated (based on time elapsed since last update)
	function mintACX() private {
		/* 3 cases:
			a. last update and now are in deterministic period
			b. last update is in deterministic period, now is dynamic period
			c. last update and now are in dynamic period
		*/

		uint256 updatedMintedAmount = getMintedAmountForTimestamp(now);

		// Calculate delta for ACX minting
		uint256 delta = updatedMintedAmount.sub(ACX_minted);

		// Increase ACX balance available for allocates/claims
		ACX_balance += delta;
		ACX_minted = updatedMintedAmount;

		// Should mint actual tokens as well
		if (!token.mint(address(this), delta)) {
			revert();
		}
	}

	// updates ETH unlocked every time ETH rewards are allocated (based on time elapsed since last update)
	function unlockETH() private {
		/* 2 cases
			a. now is in unlocking period
			b. last_update is in unlocking period, now is past it
		*/

		// Amount of ETH should be linear between 0 and ETH_unlocking_period
		// capping at ETH_total
		if (last_ETH_update <= genesis + ETH_unlocking_period) {
			uint256 linearTime = now;
			if (linearTime > genesis + ETH_unlocking_period) {
				linearTime = genesis + ETH_unlocking_period;
			}

			uint256 newUnlockedValue = linearTime.sub(genesis).mul(ETH_total).div(ETH_unlocking_period);
			uint256 delta = newUnlockedValue.sub(ETH_unlocked);
			ETH_unlocked = newUnlockedValue;
			ETH_balance += delta;
		}

		last_ETH_update = now;
	}

	/**
	* Toggle inflation vote for the sender
	* Sender's balance of ACX is considered as weight
	*/
	function inflationSwitch() public {
		// flip the inflation vote of the sender's tokens
		bool support = inflation_votes[msg.sender];
		uint256 balance = token.balanceOf(msg.sender);
		if (support) {
			inflation_votes[msg.sender] = false;
			inflation_support = inflation_support.sub(balance);
		}
		else {
			inflation_votes[msg.sender] = true;
			inflation_support = inflation_support.add(balance);
		}
	}

	/**
	*  Resets inflation vote of an address. Should be called by a controller when
	*  a token transfer happens from this address
	*
	* @param _addr - address to reset the vote for
	*/
	function resetInflationVote(address _addr) external {
		// Only token contract can call this method
		require(msg.sender == address(token));

		bool support = inflation_votes[_addr];
		if (support) {
			uint256 balance = token.balanceOf(_addr);
			inflation_votes[_addr] = false;
			inflation_support = inflation_support.sub(balance);
		}
	}

	/**
	* Recalculates inflation for the next astronomical year
	* Can be called once every year, otherwise reverts
	* Also, cannot be called before deterministic period expires
	*/
	function updateInflation() external onlyController {
		uint256 currentTime = now;
		require(currentTime > last_inflation_update + inflation_period);
		require(currentTime >= genesis + deterministic_minting_period);

		inflation_timestamp.push(currentTime);

		// Calculate inflation rate as wei-tokens per year
		uint256 newInflationRate = inflation_support / 100;
		inflation_rate.push(newInflationRate);

		last_inflation_update = currentTime;
	}

	/**
	* Get current inflation period
	*
	* @return current inflation rate multipled by inflation_multiplier
	*/
	function getCurrentInflation() public constant returns (uint256) {
		if (inflation_rate.length > 0)
			return inflation_rate[inflation_rate.length-1];
		else
			return 0;
	}
}
