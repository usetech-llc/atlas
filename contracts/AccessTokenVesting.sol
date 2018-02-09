pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Timestamped.sol";
import "./AccessToken.sol";

contract AccessTokenVesting is Ownable , Timestamped {
	using SafeMath for uint256;

	event Released(address beneficiary, uint256 amount);
	event Revoked(address beneficiary);

	// access token instance
	AccessToken public token;

	address[] public exchangeWallets = [
		address(0xa59D6A65246b1CBD380a378C531d44aD59D26156)
	];
	uint256 public exchangeWalletCount = 1;

	address[] public teamWallets = [
		address(0x2d8a71828BB86aaCF912E50768173c7Af270fd01),
		address(0x2D8A71828Bb86aACf912E50768173C7af270Fd02),
		address(0x2d8A71828Bb86aAcf912E50768173c7af270Fd03),
		address(0x2D8A71828BB86aacf912E50768173C7Af270fD04),
		address(0x2D8A71828Bb86aacF912E50768173c7Af270Fd05),
		address(0x2d8a71828bb86aAcF912e50768173c7Af270FD06)
	];
	uint256 public teamWalletCount = 6;
	
	address[] public advisorWallets = [	
		address(0x876323A34e1703096892d6Dd2e7ba9E10343F9A1),
		address(0x876323A34E1703096892d6DD2e7BA9e10343f9a2),
		address(0x876323A34e1703096892D6Dd2e7bA9E10343f9A3),
		address(0x876323A34e1703096892d6Dd2E7BA9E10343F9A4),
		address(0x876323A34E1703096892D6dD2e7BA9E10343F9A5),
		address(0x876323a34e1703096892D6Dd2E7BA9E10343F9a6),
		address(0x876323A34E1703096892D6dD2E7ba9E10343F9a7),
		address(0x876323a34E1703096892D6dD2e7bA9e10343F9A8),
		address(0x876323a34e1703096892d6dd2E7ba9E10343f9A9)
	];
	uint256 public advisorWalletCount = 9;

	// wallets coded into platform 
	mapping (address => uint256) public beneficiaries;

	// duration of vesting
	uint256 public cliff;
	uint256 public start;
	uint256 public duration;

	bool public revocable;
	bool public distributed;

	uint256 public claimable = 25;

	mapping (address => uint256) public released;
	mapping (address => uint256) public refunds;
	mapping (address => bool) public revoked;

	/**
	 * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
	 * _beneficiary, gradually in a linear fashion until _start + _duration. By then all
	 * of the balance will have vested.
	 * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
	 * @param _duration duration in seconds of the period in which the tokens will vest
	 * @param _revocable whether the vesting is revocable or not
	 */
	function AccessTokenVesting(address _tokenAddress , uint256 _start, uint256 _cliff, uint256 _duration, bool _revocable) public {
		require(_cliff <= _duration);

		token = AccessToken(_tokenAddress);

		revocable = _revocable;
		duration = _duration;
		cliff = _start.add(_cliff);
		start = _start;

		// exchange wallets
		beneficiaries[exchangeWallets[0]] = 1620000000E18;
			
		// team wallets	
		beneficiaries[teamWallets[0]] = 150000000E18;
		beneficiaries[teamWallets[1]] = 150000000E18;
		beneficiaries[teamWallets[2]] = 150000000E18;
		beneficiaries[teamWallets[3]] = 150000000E18;
		beneficiaries[teamWallets[4]] = 150000000E18;
		beneficiaries[teamWallets[5]] = 150000000E18;

		// advisor wallets
		beneficiaries[advisorWallets[0]] = 26666666E18;
		beneficiaries[advisorWallets[1]] = 26666666E18;
		beneficiaries[advisorWallets[2]] = 26666666E18;
		beneficiaries[advisorWallets[3]] = 26666666E18;
		beneficiaries[advisorWallets[4]] = 26666666E18;
		beneficiaries[advisorWallets[5]] = 26666666E18;
		beneficiaries[advisorWallets[6]] = 26666666E18;
		beneficiaries[advisorWallets[7]] = 26666666E18;
		beneficiaries[advisorWallets[8]] = 26666672E18;
	}

	/**
	 * @notice Transfers initial amount to different vesting wallets
	 */
	function distribute() public {
		require(distributed == false);

		uint256 totalTokens = 0;
		uint256 i = 0;

		totalTokens = totalTokens.add(beneficiaries[exchangeWallets[0]]);

		for(i = 0 ; i < teamWallets.length; i ++) {
			totalTokens = totalTokens.add(beneficiaries[teamWallets[i]]);
		}

		for(i = 0 ; i < advisorWallets.length; i ++) {
			totalTokens = totalTokens.add(beneficiaries[advisorWallets[i]]);
		}

		uint256 balance = token.balanceOf(this);
		require(balance >= totalTokens);

		uint256 amount = 0;
		
		amount = beneficiaries[exchangeWallets[0]];
		token.transfer(exchangeWallets[0] , amount);
		beneficiaries[exchangeWallets[0]] = beneficiaries[exchangeWallets[0]].sub(amount); 

		for(i = 0 ; i < teamWallets.length; i ++) {
			amount = beneficiaries[teamWallets[i]].mul(claimable).div(100);
			token.transfer(teamWallets[i] , amount);
			beneficiaries[teamWallets[i]] = beneficiaries[teamWallets[i]].sub(amount); 
		}

		for(i = 0 ; i < advisorWallets.length; i ++) {
			amount = beneficiaries[advisorWallets[i]].mul(claimable).div(100);
			token.transfer(advisorWallets[i] , amount);
			beneficiaries[advisorWallets[i]] = beneficiaries[advisorWallets[i]].sub(amount); 
		}

		distributed = true;
	}

	/**
	 * @notice Transfers vested tokens to beneficiary.
	 * @param beneficiary ERC20 beneficiary which is being vested
	 */
	function release(address beneficiary) public {
		require(beneficiaries[beneficiary] > 0);
		require(!revoked[beneficiary]);
		
		uint256 unreleased = releasableAmount(beneficiary);
		require(unreleased > 0);

		released[beneficiary] = released[beneficiary].add(unreleased);

		token.transfer(beneficiary, unreleased);

		Released(beneficiary , unreleased);
	}
	
	/**
	 * @notice Allows the owner to revoke the vesting for beneficiary. Tokens already vested
	 * remain in the contract, the rest are returned to the owner.
	 * @param beneficiary address of beneficiary
	 */
	function revoke(address beneficiary) public onlyOwner {
		require(revocable);
		require(!revoked[beneficiary]);

		uint256 total = beneficiaries[beneficiary];

		uint256 refund = total.sub(released[beneficiary]);

		revoked[beneficiary] = true;
		refunds[beneficiary] = refunds[beneficiary].add(refund);

		token.transfer(owner, refund);

		Revoked(beneficiary);
	}

	/**
	 * @dev Calculates the amount that has already vested but hasn't been released yet.
	 * @param beneficiary beneficiary which is being vested
	 */
	function releasableAmount(address beneficiary) public view returns (uint256) {
		return vestedAmount(beneficiary).sub(released[beneficiary]);
	}

	/**
	 * @dev Calculates the amount that available.
	 * @param beneficiary beneficiary which is being vested
	 */
	function availableAmount(address beneficiary) public view returns (uint256) {
		uint256 totalBalance = beneficiaries[beneficiary];
		uint256 leftBalance = totalBalance.sub(released[beneficiary]);
		return leftBalance;
	}

	/**
	 * @dev Calculates the amount that has already vested.
	 * @param beneficiary beneficiary which is being vested
	 */
	function vestedAmount(address beneficiary) public view returns (uint256) {
		uint256 totalBalance = beneficiaries[beneficiary];

		if (getBlockTime() < cliff) {
			return 0;
		} else if (getBlockTime() >= start.add(duration) || revoked[beneficiary]) {
			return totalBalance;
		} else {
			return totalBalance.mul(getBlockTime().sub(start)).div(duration);
		}
	}

	/**
	 * @dev Calculates the amount that has already vested.
	 * @param beneficiary beneficiary which is being vested
	 */
	function vestedAmountType(address beneficiary) public view returns (uint256) {
		if (getBlockTime() < cliff) {
			return 0;
		} else if (getBlockTime() >= start.add(duration) || revoked[beneficiary]) {
			return 1;
		} else {
			return 2;
		}
	}
}