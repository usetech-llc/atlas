pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./AccessToken.sol";
import "./Timestamped.sol";
import "./AccessTokenVesting.sol";

contract AccessTokenSale is Ownable, Timestamped {
	using SafeMath for uint256;

	// token
	AccessToken public token;

	// reference addresses
	address public tokenAddress;

	// starting time of this contract
	uint256 public startAt = 1517184000;

	// ether to usd price
	uint256 public ethToUsd = 1000;
	
	// phase 0 variables
	uint256 public phase0Hardcap = 660000000E18;
	uint256 public phase0TokenSold = 0;
	uint256 public phase0EtherRaised = 0;

	// phase 1 variables
	uint256 public phase1Hardcap = phase0Hardcap + 540000000E18;
	uint256 public phase1Rate = 0.020 ether / ethToUsd;	
	uint256 public phase1TokenSold = 0;
	uint256 public phase1EtherRaised = 0;
	uint256 public phase1StartAt = startAt;	
	uint256 public phase1EndAt = phase1StartAt + 14 days - 1;	

	// phase 2 variables
	uint256 public phase2Hardcap = phase1Hardcap + 420000000E18;
	uint256 public phase2Rate = 0.025 ether / ethToUsd;	
	uint256 public phase2TokenSold = 0;
	uint256 public phase2EtherRaised = 0;
	uint256 public phase2StartAt = phase1EndAt + 1;	
	uint256 public phase2EndAt = phase2StartAt + 2 days - 1;	

	// phase 3 variables
	uint256 public phase3Hardcap = phase2Hardcap;
	uint256 public phase3Rate = 0.025 ether / ethToUsd;	
	uint256 public phase3TokenSold = 0;
	uint256 public phase3EtherRaised = 0;
	uint256 public phase3StartAt = phase2EndAt + 1;	
	uint256 public phase3EndAt = phase3StartAt + 28 days - 1;	

	// softcap for final stage
	uint256 public phase3Softcap = phase2Hardcap / 2;

	// whitelist addresses
	mapping(address => bool) public whitelist;

	// whitelist count
	uint256 public whitelistCount;

	// phase2 day1 contributions
	mapping(address => uint256) public phase2Day1Contribution;

	// phase2 day2 contributions
	mapping(address => uint256) public phase2Day2Contribution;

	// amount of token sold so far
	uint256 public totalTokenSold;

	// amount of ether raised in sale
	uint256 public totalEtherRaised;

	// ether raised per wallet
	mapping(address => uint256) public etherRaisedPerWallet;

	// is contract close and ended
	bool public isClose = false;

	// is contract paused
	bool public isPaused = false;

	// token purchsae event
	event TokenPurchase(address indexed _purchaser, address indexed _beneficiary, uint256 _value, uint256 _amount, uint256 _timestamp);

	// manual transfer by admin for external purchase
	event TransferManual(address indexed _from, address indexed _to, uint256 _value, string _message);

	// exchange ether variables 
	address public exchangeEtherWallet = address(0xA59D6a65246B1cbd380a378c531d44aD59d26153);
	uint256 public exchangeEtherShare = 25;

	// access team ether variables 
	address public teamEtherWallet = address(0xa59D6A65246b1CBD380a378c531D44ad59d26154);
	uint256 public teamEtherShare = 55;

	// access team ether variables 
	address public incentiveEtherWallet = address(0xa59D6A65246B1Cbd380A378C531D44aD59D26155);
	uint256 public incentiveEtherShare = 20;

	// exchange address 
	address public exchangeAddress = address(0xa59D6A65246b1CBD380a378C531d44aD59D26156);

	// token vesting contract
	AccessTokenVesting public tokenVesting;
	address public tokenVestingAddress;
	uint256 public tokenVestingAmount = 1620000000E18 + 900000000E18 + 240000000E18;
	bool public tokenVestingDistributed;

	function AccessTokenSale(address _tokenAddress, address _tokenVestingAddress) public {
		token = AccessToken(_tokenAddress);
		tokenAddress = _tokenAddress;

		tokenVesting = AccessTokenVesting(_tokenVestingAddress);
		tokenVestingAddress = _tokenVestingAddress;
	}

	/**
	 * @dev Function that set whitelist addresses
	 *
	 * @param _address address to manage
	 * @param _status whether to allow or not
	 */
	function setWhitelist(address _address, bool _status) onlyOwner public {
		require(getBlockTime() <= phase1EndAt);
		require(whitelist[_address] != _status);
		whitelist[_address] = _status;
		
		if(_status) {
			whitelistCount = whitelistCount + 1;
		} else {
			whitelistCount = whitelistCount - 1;
		}
	}

	/**
	 * @dev Function that checks if address is whitelist or not
	 *
	 * @param _address address to check
	 *
	 * @return returns boolean indicating if allowed or not
	 */

	function getWhitelist(address _address) public view returns (bool) {
		return whitelist[_address];
	}

	/**
	 * @dev Function that returns the phase2 day1 limit
	 *
	 * @return returns integer indicating the day1 limit
	 */

	function getPhase2Day1Limit() public view returns (uint256) {
		uint256 phase2Available = phase2Hardcap - phase1TokenSold - phase0TokenSold;
		uint256 phase2Day1Limit = phase2Available.div(whitelistCount);
		return phase2Day1Limit;
	}

	/**
	 * @dev Function that returns the phase2 day2 limit
	 *
	 * @return returns integer indicating the day2 limit
	 */

	function getPhase2Day2Limit() public view returns (uint256) {
		uint256 phase2Day1Limit = getPhase2Day1Limit();
		uint256 phase2Day2Limit = phase2Day1Limit.mul(2);
		return phase2Day2Limit;
	}

	/**
	 * @dev Function that returns the phase2 day1 available for user
	 *
	 * @return returns integer indicating the day1 limit
	 */

	function getPhase2Day1Left(address contributor) public view returns (uint256) {
		uint256 phase2Day1Limit = getPhase2Day1Limit();
		return phase2Day1Limit.sub(phase2Day1Contribution[contributor]);
	}

	/**
	 * @dev Function that returns the phase2 day2 available for user
	 *
	 * @return returns integer indicating the day2 limit
	 */

	function getPhase2Day2Left(address contributor) public view returns (uint256) {
		uint256 phase2Day2Limit = getPhase2Day2Limit();
		return phase2Day2Limit.sub(phase2Day2Contribution[contributor]);
	}

	/**
	 * @dev Function that validates if the purchase is valid by verifying the parameters
	 *
	 * @param contributor Address of contributor
	 * @param value Amount of ethers sent
	 * @param amount Total number of tokens user is trying to buy.
	 *
	 * @return checks various conditions and returns the bool result indicating validity.
	 */
	function validate(address contributor, uint256 value, uint256 amount) public view returns (bool) {
		// check if timestamp and amount is falling in the range
		bool validTimestamp = false;
		bool validAmount = false;
		bool validWhitelist = true;
		bool validWhitelistLimit = true;

		// check if phase 1 is running	
		if(phase1StartAt <= getBlockTime() && getBlockTime() <= phase1EndAt) {
			validTimestamp = true;
			validAmount = phase1Hardcap.sub(totalTokenSold) >= amount;
		}

		// check if phase 2 is running	
		else if(phase2StartAt <= getBlockTime() && getBlockTime() <= phase2EndAt) {
			validTimestamp = true;
			validAmount = phase2Hardcap.sub(totalTokenSold) >= amount;
			validWhitelist = getWhitelist(contributor);

			// check if day 1 is running
			if(phase2StartAt <= getBlockTime() && getBlockTime() <= phase2StartAt + 1 days - 1) {
				uint256 phase2Day1Limit = getPhase2Day1Limit();
				validWhitelistLimit = phase2Day1Limit.sub(phase2Day1Contribution[contributor]) >= amount;
			}
			// check if day 2 is running
			else if(phase2StartAt + 1 days <= getBlockTime() && getBlockTime() <= phase2EndAt) {
				uint256 phase2Day2Limit = getPhase2Day2Limit();
				validWhitelistLimit = phase2Day2Limit.sub(phase2Day2Contribution[contributor]) >= amount;	
			}
		}

		// check if phase 3 is running	
		else if(phase3StartAt <= getBlockTime() && getBlockTime() <= phase3EndAt) {
			validTimestamp = true;
			validAmount = phase3Hardcap.sub(totalTokenSold) >= amount;
		}

		// check if value of the ether is valid
		bool validValue = value != 0;

		// check if the tokens available in contract for sale
		bool validToken = amount != 0;

		// validate if all conditions are met
		return validTimestamp && validAmount && validValue && validToken && validWhitelist && validWhitelistLimit && !isClose && !isPaused;
	}

	/**
	 * @dev Function that calculates if the amount by accepting ether value
	 *
	 * @param value Amount of ethers sent
	 *
	 * @return checks various conditions and returns the amount of tokens
	 */
	function calculate(uint256 value) public view returns (uint256) {
		uint256 amount = 0;
			
		// check if phase 1 is running	
		if(phase1StartAt <= getBlockTime() && getBlockTime() <= phase1EndAt) {
			// calculate the amount of tokens
			amount = value.mul(1E18).div(phase1Rate);
		}

		// check if phase 2 is running	
		else if(phase2StartAt <= getBlockTime() && getBlockTime() <= phase2EndAt) {
			// calculate the amount of tokens
			amount = value.mul(1E18).div(phase2Rate);
		}

		// check if phase 3 is running	
		else if(phase3StartAt <= getBlockTime() && getBlockTime() <= phase3EndAt) {
			// calculate the amount of tokens
			amount = value.mul(1E18).div(phase3Rate);
		}

		return amount;
	}

	/**
	 * @dev Function that updates the value of state variables
	 *
	 * @param contributor Contributor address
	 * @param value Amount of ethers sent
	 * @param amount Amount of tokens sold
	 *
	 * @return checks various conditions and saves the state variabless
	 */
	function update(address contributor, uint256 value, uint256 amount) internal returns (bool) {

		// update the state to log the sold tokens and raised ethers.
		totalTokenSold = totalTokenSold.add(amount);
		totalEtherRaised = totalEtherRaised.add(value);
		etherRaisedPerWallet[contributor] = etherRaisedPerWallet[contributor].add(value);

		// check if phase 1 is running	
		if(phase1StartAt <= getBlockTime() && getBlockTime() <= phase1EndAt) {
			// add tokens to phase1 counts
			phase1TokenSold = phase1TokenSold.add(amount);
			phase1EtherRaised = phase1EtherRaised.add(value);
		}

		// check if phase 2 is running	
		else if(phase2StartAt <= getBlockTime() && getBlockTime() <= phase2EndAt) {
			// add tokens to phase2 counts
			phase2TokenSold = phase2TokenSold.add(amount);
			phase2EtherRaised = phase2EtherRaised.add(value);

			// check if day 1 is running
			if(phase2StartAt <= getBlockTime() && getBlockTime() <= phase2StartAt + 1 days - 1) {
				phase2Day1Contribution[contributor] = phase2Day1Contribution[contributor].add(amount);
			}
			// check if day 2 is running
			else if(phase2StartAt + 1 days <= getBlockTime() && getBlockTime() <= phase2EndAt) {
				phase2Day2Contribution[contributor] = phase2Day2Contribution[contributor].add(amount);
			}
		}

		// check if phase 3 is running	
		else if(phase3StartAt <= getBlockTime() && getBlockTime() <= phase3EndAt) {
			// add tokens to phase3 counts
			phase3TokenSold = phase3TokenSold.add(amount);
			phase3EtherRaised = phase3EtherRaised.add(value);
		}
	}

	/**
	 * @dev Default fallback method which will be called when any ethers are sent to contract
	 */
	function() public payable {
		buy(msg.sender);
	}

	/**
	 * @dev Function that is called either externally or by default payable method
	 *
	 * @param beneficiary who should receive tokens
	 */
	function buy(address beneficiary) public payable {
		require(beneficiary != address(0));

		// amount of ethers sent
		uint256 value = msg.value;

		// calculate tokens
		uint256 tokens = calculate(value);

		// validate the purchase
		require(validate(msg.sender, value , tokens));

		// update current state 
		update(msg.sender , value , tokens);
		
		// transfer tokens from contract balance to beneficiary account. calling ERC223 method
		token.transfer(beneficiary, tokens);
		
		// log event for token purchase
		TokenPurchase(msg.sender, beneficiary, value, tokens, now);
	}

	/**
	* @dev transmit token for a specified address from phase 0 funds. 
	* This is owner only method and should be called using external interface for private investments
	* 
	* @param _to The address to transmit to.
	* @param _value The amount to be transferred.
	* @param _ether ether sent by private investor.
	*/
	function transferManualFromPhase0(address _to, uint256 _value, uint256 _ether) onlyOwner public returns (bool) {
		// require(_to != address(0));
		require(phase0Hardcap >= phase0TokenSold.add(_value));

		// transfer tokens manually from contract balance
		token.transfer(_to , _value);
		
		// update phase 0 variables
		phase0EtherRaised = phase0EtherRaised.add(_ether);
		phase0TokenSold = phase0TokenSold.add(_value);

		// update global variables
		totalEtherRaised = totalEtherRaised.add(_ether);
		totalTokenSold = totalTokenSold.add(_value);

		return true;
	}

	/**
	* @dev transmit token for a specified address. 
	* This is owner only method and should be called using web3.js if someone is trying to buy token using bitcoin or any other altcoin.
	* 
	* @param _to The address to transmit to.
	* @param _value The amount to be transferred.
	* @param _message message to log after transfer.
	*/
	function transferManual(address _to, uint256 _value, string _message) onlyOwner public returns (bool) {
		require(_to != address(0));

		// transfer tokens manually from contract balance
		token.transfer(_to , _value);
		TransferManual(msg.sender, _to, _value, _message);
		return true;
	}

	/**
	 * @dev Function that checks if softcap is reached
	 *
	 * @return boolean indicating if softcap reached
	 */
	function isSoftcapReached() public view returns (bool) {
		return totalTokenSold > phase3Softcap ? true : false;
	}

	/**
	 * @dev Function that checks if hardcap is reached
	 *
	 * @return boolean indicating if hardcap reached
	 */
	function isHardcapReached() public view returns (bool) {
		return totalTokenSold == phase3Hardcap ? true : false;
	}

	/**
	 * @dev Function that checks if hardcap is reached
	 *
	 * @return boolean indicating if hardcap reached
	 */
	function getHardcapDiff() public view returns (uint256) {
		return phase3Hardcap.sub(totalTokenSold);
	}

	/**
	 * @dev Function that checks if refundable
	 *
	 * @return boolean indicating if refundable reached
	 */
	function isRefundable() public view returns (bool) {
		if(!isSoftcapReached() && phase3EndAt < getBlockTime()) {
			return true;
		} else {
			return false;
		}
	}

	/**
	* @dev claim refund 
	* This will allow user to claim the refund
	*/	
	function claimRefund() public {
		require(isRefundable());
		require(etherRaisedPerWallet[msg.sender] > 0);
		msg.sender.transfer(etherRaisedPerWallet[msg.sender]);
		etherRaisedPerWallet[msg.sender] = 0;
	}

	/**
	* @dev distribute ethers
	* This will allow owner to send ethers to different wallets
	*/	
	function distributeEthers() onlyOwner public {
		require(phase3EndAt < getBlockTime());
		require(isSoftcapReached());

		uint256 balance = this.balance;
		
		// distribute funds to founders 		
		uint256 exchangeEtherPart = balance.mul(exchangeEtherShare).div(100);
		if(exchangeEtherPart > 0) {
			exchangeEtherWallet.transfer(exchangeEtherPart);
		}

		// distribute funds to technology 		
		uint256 teamEtherPart = balance.mul(teamEtherShare).div(100);
		if(teamEtherPart > 0) {
			teamEtherWallet.transfer(teamEtherPart);
		}

		// distribute left balance to project
		uint256 incentiveEtherPart = this.balance;
		if(incentiveEtherPart > 0) {
			incentiveEtherWallet.transfer(incentiveEtherPart);
		}
	}

	/**
	* @dev deploy vesting contract and distribute tokens
	* This will allow owner to send tokens to different vesting contracts
	*/	
	function distributeTokens() onlyOwner public {
		require(tokenVestingDistributed == false);

		// check balance and send tokens to token vesting contract
		uint256 balance = token.balanceOf(this);
		require(balance > tokenVestingAmount);
		token.transfer(tokenVestingAddress , tokenVestingAmount);

		// distribute initial tokens from token vesting contract
		tokenVesting.distribute();

		// set flag to prevent second distribution
		tokenVestingDistributed = true;
	}

	/**
 	* @dev send to exchange
 	* This will allow owner to send tokens to exchange address
 	*/	
 	function sendToExchange() onlyOwner public {
 		require(phase3EndAt < getBlockTime());
 		require(isSoftcapReached());
 		require(!isHardcapReached());
 
 		// send remaining funds to exchange
 		var balance = token.balanceOf(this);
 		token.transfer(exchangeAddress , balance);
 	}

	/**
	* @dev close contract 
	* This will mark contract as closed
	*/	
	function close() onlyOwner public {
		// mark the flag to indicate closure of the contract
		isClose = true;
	}

	/**
	* @dev pause contract 
	* This will mark contract as paused
	*/	
	function pause() onlyOwner public {
		// mark the flag to indicate pause of the contract
		isPaused = true;
	}

	/**
	* @dev resume contract 
	* This will mark contract as resumed
	*/	
	function resume() onlyOwner public {
		// mark the flag to indicate resume of the contract
		isPaused = false;
	}
}
