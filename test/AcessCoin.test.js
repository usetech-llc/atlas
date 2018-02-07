/*

AccessCoin
			is MintableToken
				is StandardToken
					is BasicToken
						is ERC20Basic
					is ERC20
						is ERC20Basic
				is Ownable

	MintableToken (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/token/MintableToken.test.js)
		start with a totalSupply of 0
		return mintingFinished false after construction
		mint a given amount of tokens to a given address
		fail to mint after call to finishMinting

	StandardToken (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/token/StandardToken.test.js)
		return the correct totalSupply after construction
		return the correct allowance amount after approval
		return correct balances after transfer
		throw an error when trying to transfer more than balance
		return correct balances after transfering from another account
		throw an error when trying to transferFrom more than _from has
	-VALIDATING ALLOWANCE UPDATES TO SPENDER
		start with zero
		increase by 50 then decrease by 10
		increase by 50 then set to 0 when decreasing by more than 50
		throw an error when trying to transfer to 0x0
		throw an error when trying  transferFrom to 0x0			

	ERC20Basic(https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/token/DetailedERC20.test.js)
		have a name
		have a symbol
		have an amount of decimals

	Ownable (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/ownership/Ownable.test.js)
		have an owner
		change owner after transfer
		prevent non-owners from transfering
		guard ownsership against stuck state		


Vesting
		is Ownable

	TokenVesting (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/token/TokenVesting.test.js)
		cannot be released before cliff
		can be released after cliff
		release proper amount after cliff
		linearly release tokens during vesting period
		release all after end
		revoke by owner if revocable is set
		fail to revoke by owner if revokable not set
		return non-vested tokens when revoked by owner
		keep vested tokens when revoked by owner
		fail to be revoked a second time

CappedCrowdsale
				is Crowdsale

	CappedCrowdsale (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/crowdsale/CappedCrowdsale.test.js)
	-CREATING A VALID CROWDSALE
		fail with 0 cap
	-ACCEPTING PAYMENTS
		accept payments within cap
		reject payments outside of cap
		rejects payments that exceed cap
	-ENDING
		not be ended if under cap
		not be ended if just under cap
		be ended if cap reached

	Crowdsale (https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/crowdsale/Crowdsale.test.js)
	-ACCEPTING PAYMENTS
		reject payments before start
		accept payments after start
		reject payments after end
	-HIGH-LEVEL PURCHASE and LOW-LEVEL PURCHASE
		log purchase
		increase totalSupply
		assign tokens to sender
		forward funds to wallet


*/



