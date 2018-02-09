'use strict';
var assert_throw = require('./helpers/utils').assert_throw;

var AccessToken = artifacts.require("./AccessToken.sol");
var AccessTokenSale = artifacts.require("./AccessTokenSale.sol");
var AccessTokenVesting = artifacts.require("./AccessTokenVesting.sol");

const promisify = (inner) =>
	new Promise((resolve, reject) =>
		inner((err, res) => {
			if (err) { reject(err) }
			resolve(res);
		})
);

const getBalance = (account, at) => promisify(cb => web3.eth.getBalance(account, at, cb));
const makeNumber = (number) => {return parseInt(number * 10 ** -18)}; 		
const toTimestamp = (strDate) => { var datum = Date.parse(strDate); return datum/1000; }
const getTokenBalance = async (account) => {
	var balance = await tokenInstance.balanceOf.call(account);
	return balance;
};

const reachSoftcap = async (account , reach) => {
	var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
	assert.equal(softcapReachedBefore , false , 'softcap reached should be false');	

	var refundableBefore = await saleInstance.isRefundable.call();
	assert.equal(refundableBefore , false , 'refundable should be false');	

	var totalTokenSold = await saleInstance.totalTokenSold.call();
	var phase3Softcap = await saleInstance.phase3Softcap.call();
	var phase3Batch = 40000000E18;

	for(var i = 0 ; true ; i ++) {
		var balance = await getTokenBalance(account);

		if((balance.toNumber() + phase3Batch) > phase3Softcap.toNumber()) {
			if(reach) {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
			break;
		} else {
			await saleInstance.sendTransaction({from: account, value: 1000E18});
		}
	}

	var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
	assert.equal(softcapReachedAfter , reach , 'softcap reached should be ' + reach);	
};

const approxEqual = (num1 , num2) => {
	// console.log('approxEqual ' , num1 , num2);
	// console.log(toFixed(num1) , toFixed(num2));
	if(num1 == num2) {
		return true;
	}
	
    var change = ((num1 - num2) / num1) * 100;
    if(change <= 1) {
    	return true;
    } else {
    	return false;
    }
}

function toFixed(x) {
	if (Math.abs(x) < 1.0) {
		var e = parseInt(x.toString().split('e-')[1]);
		if (e) {
				x *= Math.pow(10,e-1);
				x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
		}
	} else {
		var e = parseInt(x.toString().split('+')[1]);
		if (e > 20) {
				e -= 20;
				x /= Math.pow(10,e);
				x += (new Array(e+1)).join('0');
		}
	}
	return x;
}

var tokenInstance;
var saleInstance;
var vestingInstance;

var owner, wallet;

var day = 60 * 60 * 24;
var month = day * 30;
var year = day * 365;

// starting time of this contract
var startAt = 1517184000;

// phase 0 variables
var phase0Hardcap = 660000000E18;
var phase0TokenSold = 0;
var phase0EtherRaised = 0;

// phase 1 variables
var phase1Hardcap = phase0Hardcap + 540000000E18;
var phase1Rate = 0.0000183E18;	
var phase1TokenSold = 0;
var phase1EtherRaised = 0;
var phase1StartAt = startAt;	
var phase1EndAt = phase1StartAt + 14 * day - 1;	
var phase1BetweenAt = startAt + 1 * day + 1;

// phase 2 variables
var phase2Hardcap = phase1Hardcap + 420000000E18;
var phase2Rate = 0.0000228E18;	
var phase2TokenSold = 0;
var phase2EtherRaised = 0;
var phase2StartAt = phase1EndAt + 1;	
var phase2EndAt = phase2StartAt + 2 * day - 1;	
var phase2BetweenAt = phase2StartAt + 1 * day + 1;

// phase 3 variables
var phase3Hardcap = phase2Hardcap;
var phase3Rate = 0.0000228E18;	
var phase3TokenSold = 0;
var phase3EtherRaised = 0;
var phase3StartAt = phase2EndAt + 1;	
var phase3EndAt = phase3StartAt + 28 * day - 1;	
var phase3BetweenAt = phase2EndAt + 1 * day + 1;

// softcap for final stage
var phase3Softcap = phase2Hardcap;

var phase3
contract('AccessToken' , (accounts) => {
	owner = accounts[0];
	wallet = accounts[1];
	
	beforeEach(async () => {

		// deploy token contracts
		tokenInstance = await AccessToken.new({from: owner});

		// deploy vesting contracts	
		vestingInstance = await AccessTokenVesting.new(tokenInstance.address , phase3EndAt + 1 , 30 * day , 1080 * day , true , {from: owner});

		// deploy sale contracts	
		saleInstance = await AccessTokenSale.new(tokenInstance.address , vestingInstance.address , {from: owner});
		
		// mint tokens to sale contract
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		await tokenInstance.mint(saleInstance.address , phase3Hardcap , {from: owner});

		// mint vesting tokens to sale contract
		var tokenVestingAmount = await saleInstance.tokenVestingAmount.call();
		await tokenInstance.mint(saleInstance.address , tokenVestingAmount , {from: owner});
	});

	/* TIMESTAMPED METHODS */

	it('timestamped : should set timestamp' , async () => {
		await saleInstance.setBlockTime(123 , {from: owner});
		var timestamp = await saleInstance.getBlockTime.call();
		var ts = await saleInstance.ts.call();
		assert.equal(timestamp.toNumber() , 123 , 'timestamp should be set');
	});

	it('timestamped : should get timestamp' , async () => {
		var timestamp = await saleInstance.getBlockTime.call();
		assert.isTrue(timestamp.toNumber() > 0 , 'timestamp should be get');	
	});

	it('timestamped : should reset timestamp' , async () => {
		await saleInstance.setBlockTime(123 , {from: owner});
		var timestamp = await saleInstance.getBlockTime.call();
		assert.equal(timestamp.toNumber() , 123 , 'timestamp should be set');

		await saleInstance.setBlockTime(0);
		var timestamp = await saleInstance.getBlockTime.call();	
		assert.isTrue(timestamp > 0 , 'timestamp should be reset');
	});

	/* TOKEN CONTRACT */

	it('token : should match name' , async () => {
		var name = await tokenInstance.name.call();
		assert.equal(name , 'AccessToken' , 'name does not match');		
	});

	it('token : should match symbol' , async () => {
		var symbol = await tokenInstance.symbol.call();
		assert.equal(symbol , 'ACX' , 'symbol does not match');		
	});

	it('token : should match decimals' , async () => {
		var decimals = await tokenInstance.decimals.call();
		assert.equal(decimals , 18 , 'decimals does not match');		
	});

	it('token : should have tokens minted' , async () => {
		var balance = await tokenInstance.balanceOf.call(owner);
		assert.equal(balance.toNumber() , 0 , 'owner balance should be zero');		

		var balance = await tokenInstance.balanceOf.call(saleInstance.address);
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var tokenVestingAmount = await saleInstance.tokenVestingAmount.call();
		assert.isTrue(approxEqual(balance.toNumber() , phase3Hardcap.toNumber() + tokenVestingAmount.toNumber()) , 'balance of sale instance should match hardcap');		
	});

	/* SALE INSTANCE */

	// starting time of this contract
	it('sale : should match startAt with sale contract' , async () => {
		assert.equal(startAt , 1517184000 , "sale contract should match startAt");
	});

	// phase 0 variables
	it('sale : should match phase0Hardcap with sale contract' , async () => {
		assert.equal(phase0Hardcap , 660000000E18 , "sale contract should match phase0Hardcap");
	});


	it('sale : should match phase0TokenSold with sale contract' , async () => {
		assert.equal(phase0TokenSold , 0 , "sale contract should match phase0TokenSold");
	});

	it('sale : should match phase0EtherRaised with sale contract' , async () => {
		assert.equal(phase0EtherRaised , 0 , "sale contract should match phase0EtherRaised");
	});

	// phase 1 variables
	it('sale : should match phase1Hardcap with sale contract' , async () => {
		assert.equal(phase1Hardcap , phase0Hardcap + 540000000E18 , "sale contract should match phase1Hardcap");
	});

	it('sale : should match phase1Rate with sale contract' , async () => {
		assert.equal(phase1Rate , 0.0000183E18 , "sale contract should match phase1Rate");
	});

	it('sale : should match phase1TokenSold with sale contract' , async () => {
		assert.equal(phase1TokenSold , 0 , "sale contract should match phase1TokenSold");
	});

	it('sale : should match phase1EtherRaised with sale contract' , async () => {
		assert.equal(phase1EtherRaised , 0 , "sale contract should match phase1EtherRaised");
	});

	it('sale : should match phase1StartAt with sale contract' , async () => {
		assert.equal(phase1StartAt , startAt , "sale contract should match phase1StartAt");
	});

	it('sale : should match phase1EndAt with sale contract' , async () => {
		assert.equal(phase1EndAt , phase1StartAt + 14 * day - 1 , "sale contract should match phase1EndAt");
	});

	it('sale : should match phase2Hardcap with sale contract' , async () => {
		assert.equal(phase2Hardcap , phase1Hardcap + 420000000E18 , "sale contract should match phase2Hardcap");
	});

	it('sale : should match phase2Rate with sale contract' , async () => {
		assert.equal(phase2Rate , 0.0000228E18 , "sale contract should match phase2Rate");
	});

	it('sale : should match phase2TokenSold with sale contract' , async () => {
		assert.equal(phase2TokenSold , 0 , "sale contract should match phase2TokenSold");
	});

	it('sale : should match phase2EtherRaised with sale contract' , async () => {
		assert.equal(phase2EtherRaised , 0 , "sale contract should match phase2EtherRaised");
	});

	it('sale : should match phase2StartAt with sale contract' , async () => {
		assert.equal(phase2StartAt , phase1EndAt + 1 , "sale contract should match phase2StartAt");
	});

	it('sale : should match phase2EndAt with sale contract' , async () => {
		assert.equal(phase2EndAt , phase2StartAt + 2 * day - 1 , "sale contract should match phase2EndAt");
	});

	it('sale : should match phase3Hardcap with sale contract' , async () => {
		assert.equal(phase3Hardcap , phase2Hardcap , "sale contract should match phase3Hardcap");
	});

	it('sale : should match phase3Rate with sale contract' , async () => {
		assert.equal(phase3Rate , 0.0000228E18 , "sale contract should match phase3Rate");
	});

	it('sale : should match phase3TokenSold with sale contract' , async () => {
		assert.equal(phase3TokenSold , 0 , "sale contract should match phase3TokenSold");
	});

	it('sale : should match phase3EtherRaised with sale contract' , async () => {
		assert.equal(phase3EtherRaised , 0 , "sale contract should match phase3EtherRaised");
	});

	it('sale : should match phase3StartAt with sale contract' , async () => {
		assert.equal(phase3StartAt , phase2EndAt + 1 , "sale contract should match phase3StartAt");
	});

	it('sale : should match phase3EndAt with sale contract' , async () => {
		assert.equal(phase3EndAt , phase3StartAt + 28 * day - 1 , "sale contract should match phase3EndAt");
	});

	it('sale : should match phase3Softcap with sale contract' , async () => {
		assert.equal(phase3Softcap ,  phase2Hardcap ,  "sale contract should match phase3Softcap");
	});

	it('sale : should match sale token address' , async () => {
		var token = await saleInstance.token.call();
		assert.equal(token , tokenInstance.address , 'token address does not match');		
	});

	it('sale : should call eth to usd method' , async () => {
		await saleInstance.setEthToUsd(2000 , {from: owner});
		var ethToUsd = await saleInstance.ethToUsd.call();
		assert.equal(ethToUsd.toNumber() , 2000 , 'decimals does not match');		
	});

	it('sale : should allow owner to buy token' , async () => {
		var account = owner;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.buy(account , {from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);

		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');
	});

	it('sale : should allow owner to buy token and transfer those tokens' , async () => {
		var account1 = owner;
		var account2 = accounts[1];

		var account1BalanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.buy(account1 , {from: account1, value: 1E18});
		var account1BalanceAfter = await tokenInstance.balanceOf.call(account1);
		
		assert.equal(account1BalanceAfter.toNumber(), account1BalanceBefore.toNumber() + 50000E18 , 'balance should be increased');

		var account1BalanceBefore = await tokenInstance.balanceOf.call(account1);
		var account2BalanceBefore = await tokenInstance.balanceOf.call(account2);

		await tokenInstance.transfer(account2 , 50000E18 , {from: account1});
		
		var account1BalanceAfter = await tokenInstance.balanceOf.call(account1);
		var account2BalanceAfter = await tokenInstance.balanceOf.call(account2);

		assert.equal(account1BalanceAfter.toNumber() , account1BalanceBefore.toNumber() - 50000E18 , 'balance should be reduced');
		assert.equal(account2BalanceAfter.toNumber() , account2BalanceBefore.toNumber() + 50000E18 , 'balance should be increased');
	});

	it('sale : should allow owner to buy token and transfer those tokens and return back those tokens' , async () => {
		var account1 = owner;
		var account2 = accounts[1];

		var account1BalanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.buy(account1 , {from: account1, value: 1E18});
		var account1BalanceAfter = await tokenInstance.balanceOf.call(account1);
		
		assert.equal(account1BalanceAfter.toNumber(), account1BalanceBefore.toNumber() + 50000E18 , 'balance should be increased');

		var account1BalanceBefore = await tokenInstance.balanceOf.call(account1);
		var account2BalanceBefore = await tokenInstance.balanceOf.call(account2);

		await tokenInstance.transfer(account2 , 50000E18 , {from: account1});
		
		var account1BalanceAfter = await tokenInstance.balanceOf.call(account1);
		var account2BalanceAfter = await tokenInstance.balanceOf.call(account2);

		assert.equal(account1BalanceAfter.toNumber() , account1BalanceBefore.toNumber() - 50000E18 , 'balance should be reduced');
		assert.equal(account2BalanceAfter.toNumber() , account2BalanceBefore.toNumber() + 50000E18 , 'balance should be increased');

		var account1BalanceBefore = await tokenInstance.balanceOf.call(account1);
		var account2BalanceBefore = await tokenInstance.balanceOf.call(account2);

		await tokenInstance.transfer(account1 , 50000E18 , {from: account2});
		
		var account1BalanceAfter = await tokenInstance.balanceOf.call(account1);
		var account2BalanceAfter = await tokenInstance.balanceOf.call(account2);

		assert.equal(account1BalanceAfter.toNumber() , account1BalanceBefore.toNumber() + 50000E18 , 'balance should be reduced');
		assert.equal(account2BalanceAfter.toNumber() , account2BalanceBefore.toNumber() - 50000E18 , 'balance should be increased');
	});

	it('sale : should allow owner to transfer tokens manually' , async () => {
		var account = owner;
		var units = 62500E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.transferManual(account , units , "" , {from: account});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');
	});

	it('sale : should allow owner to transfer tokens manually for phase 0' , async () => {
		var account = owner;
		var units = 62500E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		var phase0EtherRaisedBefore = await saleInstance.phase0EtherRaised.call();
		var phase0TokenSoldBefore = await saleInstance.phase0TokenSold.call();
		var totalTokenSoldBefore = await saleInstance.totalTokenSold.call();
		var totalEtherRaisedBefore = await saleInstance.totalEtherRaised.call();

		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.transferManualFromPhase0(account , units , 1E18 , {from: account});
		
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var phase0EtherRaisedAfter = await saleInstance.phase0EtherRaised.call();
		var phase0TokenSoldAfter = await saleInstance.phase0TokenSold.call();
		var totalTokenSoldAfter = await saleInstance.totalTokenSold.call();
		var totalEtherRaisedAfter = await saleInstance.totalEtherRaised.call();

		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');
		assert.equal(phase0TokenSoldAfter.toNumber(), phase0TokenSoldBefore.toNumber() + units , 'phase 0 sold should be increased');
		assert.equal(totalTokenSoldAfter.toNumber(), totalTokenSoldBefore.toNumber() + units , 'total sold should be increased');
		assert.equal(phase0EtherRaisedAfter.toNumber(), phase0EtherRaisedBefore.toNumber() + 1E18 , 'phase 0 ether should be increased');
		assert.equal(totalEtherRaisedAfter.toNumber(), totalEtherRaisedBefore.toNumber() + 1E18 , 'total ether should be increased');
	});

	it('sale : should not allow owner to transfer more than allocated token in phase 0' , async () => {
		var account = accounts[19];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1EndAt);
		
		var phase0Hardcap = await saleInstance.phase0Hardcap.call();
		var phase0Batch = 62500000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase0Hardcap) , phase0Batch , toFixed(balance.toNumber() + phase0Batch));

			if((balance.toNumber() + phase0Batch) > phase0Hardcap.toNumber()) {
				assert_throw(saleInstance.transferManualFromPhase0(account , phase0Batch , 1000E18 , {from: owner}));
				break;
			} else {
				await saleInstance.transferManualFromPhase0(account , phase0Batch , 1000E18 , {from: owner});
			}
		}
	});

	it('sale : should allow user to buy token' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.buy(account , {from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token from fallback address' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		
	});

	it('sale : should not allow user to buy token before start of phase 0' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(startAt - day);
		assert_throw(saleInstance.sendTransaction({from: account, value: 1E18}));
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() , 'balance should not be increased');		
	});

	it('sale : should allow user to buy token in phase 1 in start' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 1 in between' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1BetweenAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 1 in end' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1EndAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		
	});

	it('sale : should not allow user to buy more than allocated token in phase 1' , async () => {
		var account = accounts[19];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1EndAt);
		
		var phase1Hardcap = await saleInstance.phase1Hardcap.call();
		var phase1Batch = 50000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase1Hardcap) , phase1Batch , toFixed(balance.toNumber() + phase1Batch));

			if((balance.toNumber() + phase1Batch) > phase1Hardcap.toNumber()) {
				assert_throw(saleInstance.sendTransaction({from: account, value: 1000E18}));
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}
	});

	it('sale : should allow user to buy token in phase 2 in start' , async () => {
		var account = accounts[3];
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 2 in between' , async () => {
		var account = accounts[3];
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2BetweenAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 2 in end' , async () => {
		var account = accounts[3];
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2EndAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should not allow user to buy more than allocated token in phase 2' , async () => {
		var account = accounts[19];
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2EndAt);
		
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase2Hardcap) , phase2Batch , toFixed(balance.toNumber() + phase2Batch));

			if((balance.toNumber() + phase2Batch) > phase2Hardcap.toNumber()) {
				assert_throw(saleInstance.sendTransaction({from: account, value: 1000E18}));
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}
	});

	it('sale : should allow user to buy token in phase 3 in start' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 3 in between' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3BetweenAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should allow user to buy token in phase 3 in end' , async () => {
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3EndAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should not allow user to buy more than allocated token in phase 3' , async () => {
		var account = accounts[19];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3EndAt);
		
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase3Hardcap) , phase3Batch , toFixed(balance.toNumber() + phase3Batch));

			if((balance.toNumber() + phase3Batch) > phase3Hardcap.toNumber()) {
				assert_throw(saleInstance.sendTransaction({from: account, value: 1000E18}));
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}
	});

	it('sale : should track token sold for phase 1' , async () => {
		var account = accounts[3];
		var units = 50000E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		assert.equal(phase1TokenSold.toNumber(), units , 'sold should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		assert.equal(phase1TokenSold.toNumber(), units * 2 , 'sold should be increased');

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		assert.equal(totalTokenSold.toNumber(), units * 2 , 'total sold should be increased');
	});

	it('sale : should track ether raised for phase 1' , async () => {
		var account = accounts[3];	
		var units = 50000E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase1EtherRaised = await saleInstance.phase1EtherRaised.call();
		assert.equal(phase1EtherRaised.toNumber(), 1E18 , 'raised should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase1EtherRaised = await saleInstance.phase1EtherRaised.call();
		assert.equal(phase1EtherRaised.toNumber(), 1E18 * 2 , 'raised should be increased');

		var totalEtherRaised = await saleInstance.totalEtherRaised.call();
		assert.equal(totalEtherRaised.toNumber(), 1E18 * 2 , 'total raised should be increased');
	});

	it('sale : should track token sold for phase 2' , async () => {
		var account = accounts[3];
		var units = 40000E18;
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase2TokenSold = await saleInstance.phase2TokenSold.call();
		assert.equal(phase2TokenSold.toNumber(), units , 'sold should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase2TokenSold = await saleInstance.phase2TokenSold.call();
		assert.equal(phase2TokenSold.toNumber(), units * 2 , 'sold should be increased');

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		assert.equal(totalTokenSold.toNumber(), units * 2 , 'total sold should be increased');
	});

	it('sale : should track ether raised for phase 2' , async () => {
		var account = accounts[3];	
		var units = 40000E18;
		await saleInstance.setWhitelist(account , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase2EtherRaised = await saleInstance.phase2EtherRaised.call();
		assert.equal(phase2EtherRaised.toNumber(), 1E18 , 'raised should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase2EtherRaised = await saleInstance.phase2EtherRaised.call();
		assert.equal(phase2EtherRaised.toNumber(), 1E18 * 2 , 'raised should be increased');

		var totalEtherRaised = await saleInstance.totalEtherRaised.call();
		assert.equal(totalEtherRaised.toNumber(), 1E18 * 2 , 'total raised should be increased');
	});

	it('sale : should track token sold for phase 3' , async () => {
		var account = accounts[3];
		var units = 40000E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase3TokenSold = await saleInstance.phase3TokenSold.call();
		assert.equal(phase3TokenSold.toNumber(), units , 'sold should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase3TokenSold = await saleInstance.phase3TokenSold.call();
		assert.equal(phase3TokenSold.toNumber(), units * 2 , 'sold should be increased');

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		assert.equal(totalTokenSold.toNumber(), units * 2 , 'total sold should be increased');
	});

	it('sale : should track ether raised for phase 3' , async () => {
		var account = accounts[3];	
		var units = 40000E18;

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase3EtherRaised = await saleInstance.phase3EtherRaised.call();
		assert.equal(phase3EtherRaised.toNumber(), 1E18 , 'raised should be increased');


		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + units , 'balance should be increased');		

		var phase3EtherRaised = await saleInstance.phase3EtherRaised.call();
		assert.equal(phase3EtherRaised.toNumber(), 1E18 * 2 , 'raised should be increased');

		var totalEtherRaised = await saleInstance.totalEtherRaised.call();
		assert.equal(totalEtherRaised.toNumber(), 1E18 * 2 , 'total raised should be increased');
	});

	it('sale : should allow owner to set whitelist address before phase 2' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase1EndAt);

		var statusBefore = await saleInstance.getWhitelist(account);
		await saleInstance.setWhitelist(account , true , {from: owner});
		var statusAfter = await saleInstance.getWhitelist(account);

		assert.equal(statusBefore , false , 'status should be false');	
		assert.equal(statusAfter , true , 'status should be true');	
	});

	it('sale : should update whiltelist count address before phase 2' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase1EndAt);

		var countBefore = await saleInstance.whitelistCount.call();
		await saleInstance.setWhitelist(account , true , {from: owner});
		var countAfter = await saleInstance.getWhitelist(account);

		assert.equal(countBefore , 0 , 'count should be 0');	
		assert.equal(countAfter , 1 , 'count should be 1');	

		var countBefore = await saleInstance.whitelistCount.call();
		await saleInstance.setWhitelist(account , false , {from: owner});
		var countAfter = await saleInstance.getWhitelist(account);

		assert.equal(countBefore , 1 , 'count should be 1');	
		assert.equal(countAfter , 0 , 'count should be 0');	
	});

	it('sale : should not allow user to set whitelist address before phase 2' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase1EndAt);

		var statusBefore = await saleInstance.getWhitelist(account);
		assert_throw(saleInstance.setWhitelist(account , true , {from: account}));
		var statusAfter = await saleInstance.getWhitelist(account);

		assert.equal(statusBefore , false , 'status should be false');	
		assert.equal(statusAfter , false , 'status should be false');	
	});	

	it('sale : should not allow owner to set whitelist address after phase 2' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase2StartAt);

		var statusBefore = await saleInstance.getWhitelist(account);
		assert_throw(saleInstance.setWhitelist(account , true , {from: owner}));
		var statusAfter = await saleInstance.getWhitelist(account);

		assert.equal(statusBefore , false , 'status should be false');	
		assert.equal(statusAfter , false , 'status should be false');
	});

	it('sale : should not update whiltelist count address after phase 2' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase2StartAt);

		var countBefore = await saleInstance.whitelistCount.call();
		assert_throw(saleInstance.setWhitelist(account , true , {from: owner}));
		var countAfter = await saleInstance.whitelistCount.call();

		assert.equal(countBefore , 0 , 'count should be false');	
		assert.equal(countAfter , 0 , 'count should be false');
	});

	it('sale : should not update whiltelist address with same status' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase1EndAt);

		var statusBefore = await saleInstance.getWhitelist(account);
		var countBefore = await saleInstance.whitelistCount.call();
		await saleInstance.setWhitelist(account , true , {from: owner});
		var statusAfter = await saleInstance.getWhitelist(account);
		var countAfter = await saleInstance.whitelistCount.call();

		assert.equal(statusBefore , false , 'status should be false');	
		assert.equal(statusAfter , true , 'status should be true');	

		assert.equal(countBefore , 0 , 'count should be 0');	
		assert.equal(countAfter , 1 , 'count should be 1');	


		var statusBefore = await saleInstance.getWhitelist(account);
		var countBefore = await saleInstance.whitelistCount.call();
		assert_throw(saleInstance.setWhitelist(account , true , {from: owner}));
		var statusAfter = await saleInstance.getWhitelist(account);
		var countAfter = await saleInstance.whitelistCount.call();

		assert.equal(statusBefore , true , 'status should be true');	
		assert.equal(statusAfter , true , 'status should be true');	

		assert.equal(countBefore , 1 , 'count should be 1');	
		assert.equal(countAfter , 1 , 'count should be 1');
	});

	it('sale : should validate if soft cap is reached' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Softcap = await saleInstance.phase3Softcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase3Softcap) , phase3Batch , toFixed(balance.toNumber() + phase3Batch));

			if((balance.toNumber() + phase3Batch) > phase3Softcap.toNumber()) {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
				// console.log('soft cap reached');
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');	
	});

	it('sale : should validate if hard cap is reached' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var hardcapReachedBefore = await saleInstance.isHardcapReached.call();
		assert.equal(hardcapReachedBefore , false , 'hardcap reached should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);

			if((balance.toNumber() + phase3Batch) > phase3Hardcap.toNumber()) {
				var phase3Hardcap = await saleInstance.phase3Hardcap.call();
				var totalTokenSold = await saleInstance.totalTokenSold.call();
				var difference = phase3Hardcap.toNumber() - totalTokenSold.toNumber();
				await saleInstance.transferManualFromPhase0(account , difference , 0 , {from: owner});

				var hardcapDiff = await saleInstance.getHardcapDiff.call();
				await saleInstance.transferManualFromPhase0(account , hardcapDiff , 0 , {from: owner});

				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();

		var difference = toFixed(phase3Hardcap) - toFixed(totalTokenSold);
		var saleBalance = await getTokenBalance(saleInstance.address);

		assert.equal(difference , 0 , 'all tokens must be sold');
		assert.equal(totalTokenSold.toNumber() , phase3Hardcap.toNumber() , 'all tokens must be sold');
			
		var hardcapDiff = await saleInstance.getHardcapDiff.call();
		assert.equal(hardcapDiff , 0 , 'hardcap reached should be true');	

		var hardcapReachedAfter = await saleInstance.isHardcapReached.call();
		assert.equal(hardcapReachedAfter , true , 'hardcap reached should be true');	
	});

	it('sale : should validate if refundable' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Softcap = await saleInstance.phase3Softcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase3Softcap) , phase3Batch , toFixed(balance.toNumber() + phase3Batch));

			if((balance.toNumber() + phase3Batch) > phase3Softcap.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');	

		await saleInstance.setBlockTime(phase3EndAt + day);	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');	
	});

	it('sale : should validate if refundable only after end of phase 3' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Softcap = await saleInstance.phase3Softcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase3Softcap) , phase3Batch , toFixed(balance.toNumber() + phase3Batch));

			if((balance.toNumber() + phase3Batch) > phase3Softcap.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		await saleInstance.setBlockTime(phase3EndAt + day);	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');	
	});

	it('sale : should validate if not refundable if softcap is reached' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Softcap = await saleInstance.phase3Softcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase3Softcap) , phase3Batch , toFixed(balance.toNumber() + phase3Batch));

			if((balance.toNumber() + phase3Batch) > phase3Softcap.toNumber()) {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		await saleInstance.setBlockTime(phase3EndAt + day);	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	
	});

	// Claim refund
	it('sale : should allow user to claim refund if soft cap is not reached and sale ended' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		var balanceBefore = await getBalance(account);
		
		await saleInstance.setBlockTime(phase3BetweenAt);
		await saleInstance.sendTransaction({from: account , value: 1E18});
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');

		var balanceAfter = await getBalance(account);
		assert.isTrue(balanceAfter.toNumber() < balanceBefore.toNumber() - 1E18 , 'balance should be reduced');

		await saleInstance.claimRefund({from: account});
		
		var balanceAfter = await getBalance(account);
		assert.isTrue(balanceAfter.toNumber() > balanceBefore.toNumber() - 1E18 , 'balance should be restored');		
	});

	it('sale : should not allow user to claim refund if soft cap is reached' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');

		var balanceBefore = await getBalance(account);
		assert_throw(saleInstance.claimRefund({from: account}));
		var balanceAfter = await getBalance(account);

		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'balance should be same');		
	});

	it('sale : should not allow user to claim refund if sale is not ended' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');

		var balanceBefore = await getBalance(account);
		assert_throw(saleInstance.claimRefund({from: account}));
		var balanceAfter = await getBalance(account);

		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'balance should be same');		
	});

	it('sale : should not allow user to claim refund twice' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		var balanceBefore = await getBalance(account);

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , false);
		await saleInstance.setBlockTime(phase3EndAt + day);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');

		var balanceAfter = await getBalance(account);
		assert.isTrue(balanceAfter.toNumber() < balanceBefore.toNumber() - 1E18 , 'balance should be reduced');

		await saleInstance.claimRefund({from: account});
		
		var balanceAfter = await getBalance(account);
		assert.isTrue(balanceAfter.toNumber() > balanceBefore.toNumber() - 1E18 , 'balance should be restored');		

		var balanceBefore = await getBalance(account);
		assert_throw(saleInstance.claimRefund({from: account}));
		var balanceAfter = await getBalance(account);
		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'balance should be same');		
	});

	it('sale : should not allow user to claim refund if not invested' , async () => {
		var account = accounts[3];	
		var noninvestor = accounts[4];

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , false);
		await saleInstance.setBlockTime(phase3EndAt + day);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');

		var balanceBefore = await getBalance(noninvestor);
		assert_throw(saleInstance.claimRefund({from: noninvestor}));
		var balanceAfter = await getBalance(noninvestor);
		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'balance should be same');		
	});


	// Send to exchange
	it('sale : should allow owner to send remaining token to exchange if sale ended soft cap reached and hard cap not reached' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');

		var exchangeAddress = await saleInstance.exchangeAddress.call();

		var saleBalanceBefore = await getTokenBalance(saleInstance.address);
		var exchangeBalanceBefore = await getTokenBalance(exchangeAddress);
		await saleInstance.sendToExchange({from: owner});
		var saleBalanceAfter = await getTokenBalance(saleInstance.address);
		var exchangeBalanceAfter = await getTokenBalance(exchangeAddress);

		assert.equal(saleBalanceAfter.toNumber() , 0 , 'sale contract balance should be zero');
		assert.equal(exchangeBalanceAfter.toNumber() , saleBalanceBefore.toNumber() - exchangeBalanceBefore.toNumber() , 'exchange contract balance should be increased');
	});

	it('sale : should not allow user to send remaining token to exchange if sale ended soft cap reached and hard cap not reached' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');

		var exchangeAddress = await saleInstance.exchangeAddress.call();

		var saleBalanceBefore = await getTokenBalance(saleInstance.address);
		var exchangeBalanceBefore = await getTokenBalance(exchangeAddress);
		assert_throw(saleInstance.sendToExchange({from: account}));
		var saleBalanceAfter = await getTokenBalance(saleInstance.address);
		var exchangeBalanceAfter = await getTokenBalance(exchangeAddress);

		assert.equal(saleBalanceAfter.toNumber() , saleBalanceBefore.toNumber() , 'sale contract balance should be same');
		assert.equal(exchangeBalanceAfter.toNumber() , exchangeBalanceBefore.toNumber() , 'exchange contract balance should be same');
	});

	it('sale : should not allow owner to send remaining token to exchange if sale not ended' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , true , 'softcap reached should be true');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');

		var exchangeAddress = await saleInstance.exchangeAddress.call();

		var saleBalanceBefore = await getTokenBalance(saleInstance.address);
		var exchangeBalanceBefore = await getTokenBalance(exchangeAddress);
		assert_throw(saleInstance.sendToExchange({from: owner}));
		var saleBalanceAfter = await getTokenBalance(saleInstance.address);
		var exchangeBalanceAfter = await getTokenBalance(exchangeAddress);

		assert.equal(saleBalanceAfter.toNumber() , saleBalanceBefore.toNumber() , 'sale contract balance should not change');
		assert.equal(exchangeBalanceAfter.toNumber() , exchangeBalanceBefore.toNumber() , 'exchange contract balance should not change');
	});

	it('sale : should not allow owner to send remaining token to exchange if soft cap not reached' , async () => {
		var account = accounts[3];	

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , false , 'refundable should be false');	

		var softcapReachedBefore = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedBefore , false , 'softcap reached should be false');

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , false);
		await saleInstance.setBlockTime(phase3EndAt + day);

		var softcapReachedAfter = await saleInstance.isSoftcapReached.call();
		assert.equal(softcapReachedAfter , false , 'softcap reached should be false');

		var refundableBefore = await saleInstance.isRefundable.call();
		assert.equal(refundableBefore , true , 'refundable should be true');

		var exchangeAddress = await saleInstance.exchangeAddress.call();

		var saleBalanceBefore = await getTokenBalance(saleInstance.address);
		var exchangeBalanceBefore = await getTokenBalance(exchangeAddress);
		assert_throw(saleInstance.sendToExchange({from: owner}));
		var saleBalanceAfter = await getTokenBalance(saleInstance.address);
		var exchangeBalanceAfter = await getTokenBalance(exchangeAddress);

		assert.equal(saleBalanceAfter.toNumber() , saleBalanceBefore.toNumber() , 'sale contract balance should not change');
		assert.equal(exchangeBalanceAfter.toNumber() , exchangeBalanceBefore.toNumber() , 'exchange contract balance should not change');
	});

	it('sale : should not allow owner to send remaining token to exchange if hard cap reached' , async () => {
		var account = accounts[3];	
		await saleInstance.setBlockTime(phase3BetweenAt);

		var hardcapReachedBefore = await saleInstance.isHardcapReached.call();
		assert.equal(hardcapReachedBefore , false , 'hardcap reached should be false');	

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var phase3Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account);
			if((balance.toNumber() + phase3Batch) > phase3Hardcap.toNumber()) {
				var phase3Hardcap = await saleInstance.phase3Hardcap.call();
				var totalTokenSold = await saleInstance.totalTokenSold.call();
				var difference = phase3Hardcap.toNumber() - totalTokenSold.toNumber();
				await saleInstance.transferManualFromPhase0(account , difference , 0 , {from: owner});

				var hardcapDiff = await saleInstance.getHardcapDiff.call();
				await saleInstance.transferManualFromPhase0(account , hardcapDiff , 0 , {from: owner});
				break;
			} else {
				await saleInstance.sendTransaction({from: account, value: 1000E18});
			}
		}

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();

		var difference = toFixed(phase3Hardcap) - toFixed(totalTokenSold);
		var saleBalance = await getTokenBalance(saleInstance.address);

		assert.equal(difference , 0 , 'all tokens must be sold');
		assert.equal(totalTokenSold.toNumber() , phase3Hardcap.toNumber() , 'all tokens must be sold');
			
		var hardcapDiff = await saleInstance.getHardcapDiff.call();
		assert.equal(hardcapDiff , 0 , 'hardcap reached should be true');	

		var hardcapReachedAfter = await saleInstance.isHardcapReached.call();
		assert.equal(hardcapReachedAfter , true , 'hardcap reached should be true');	

		var exchangeAddress = await saleInstance.exchangeAddress.call();

		var saleBalanceBefore = await getTokenBalance(saleInstance.address);
		var exchangeBalanceBefore = await getTokenBalance(exchangeAddress);
		assert_throw(saleInstance.sendToExchange({from: owner}));
		var saleBalanceAfter = await getTokenBalance(saleInstance.address);
		var exchangeBalanceAfter = await getTokenBalance(exchangeAddress);

		assert.equal(saleBalanceAfter.toNumber() , saleBalanceBefore.toNumber() , 'sale contract balance should not change');
		assert.equal(exchangeBalanceAfter.toNumber() , exchangeBalanceBefore.toNumber() , 'exchange contract balance should not change');
	});

	it('sale : should validate phase 2 day 1 limit for 1 whitelist' , async () => {
		var account1 = accounts[5];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		

		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		

		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day1LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) / whitelistCount;

		assert.equal(phase2Day1Limit.toNumber() , phase2Day1LimitComputed , 'phase 1 day 1 limit should match');
	});

	it('sale : should validate phase 2 day 1 limit for 2 whitelist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);
		
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day1LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) / whitelistCount;

		assert.equal(toFixed(phase2Day1Limit) , toFixed(phase2Day1LimitComputed) , 'phase 1 day 1 limit should match');
	});

	it('sale : should validate phase 2 day 1 limit for 3 whitelist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		var balanceBefore = await tokenInstance.balanceOf.call(account3);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account3, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account3);

		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setWhitelist(account2 , true , {from: owner});
		await saleInstance.setWhitelist(account3 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		var balanceBefore = await tokenInstance.balanceOf.call(account3);
		await saleInstance.setBlockTime(phase2StartAt);
		await saleInstance.sendTransaction({from: account3, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account3);
		
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day1LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) / whitelistCount;

		assert.isTrue(approxEqual(phase2Day1Limit , phase2Day1LimitComputed) , 'phase 1 day 1 limit should match');
	});

	it('sale : should validate phase 2 day 2 limit for 1 whitelist' , async () => {
		var account1 = accounts[5];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 50000E18 , 'balance should be increased');		

		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		

		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day2LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) * 2 / whitelistCount;

		assert.equal(phase2Day2Limit.toNumber() , phase2Day2LimitComputed , 'phase 1 day 1 limit should match');
	});

	it('sale : should validate phase 2 day 2 limit for 2 whitelist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);
		
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day2LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) * 2 / whitelistCount;

		assert.equal(toFixed(phase2Day2Limit) , toFixed(phase2Day2LimitComputed) , 'phase 1 day 2 limit should match');
	});

	it('sale : should validate phase 2 day 2 limit for 3 whitelist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
	
		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		var balanceBefore = await tokenInstance.balanceOf.call(account3);
		await saleInstance.setBlockTime(phase1StartAt);
		await saleInstance.sendTransaction({from: account3, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account3);

		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setWhitelist(account2 , true , {from: owner});
		await saleInstance.setWhitelist(account3 , true , {from: owner});

		var balanceBefore = await tokenInstance.balanceOf.call(account1);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account1, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account1);

		var balanceBefore = await tokenInstance.balanceOf.call(account2);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account2, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account2);

		var balanceBefore = await tokenInstance.balanceOf.call(account3);
		await saleInstance.setBlockTime(phase2StartAt + day);
		await saleInstance.sendTransaction({from: account3, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account3);
		
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase0TokenSold = await saleInstance.phase0TokenSold.call();
		var phase1TokenSold = await saleInstance.phase1TokenSold.call();
		var phase2Hardcap = await saleInstance.phase2Hardcap.call();
		var whitelistCount = await saleInstance.whitelistCount.call();
		var phase2Day2LimitComputed = (phase2Hardcap - phase1TokenSold - phase0TokenSold) * 2 / whitelistCount;

		assert.isTrue(approxEqual(phase2Day2Limit , phase2Day2LimitComputed) , 'phase 2 day 2 limit should match');
	});

	it('sale : should allow user to buy in phase 2 day 1 in limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setBlockTime(phase2StartAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert.isTrue(phase2Day1Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	it('sale : should allow user to buy in phase 2 day 1 in limit on border' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setBlockTime(phase2StartAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		await saleInstance.sendTransaction({from: account1, value: 500E18});

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert.equal(phase2Day1Left.toNumber() , 0 , 'all balance should be bought');		
	});

	it('sale : should allow two user to buy in phase 2 day 1 in limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});
		
		await saleInstance.setBlockTime(phase2StartAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account2);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account2, value: 1000E18});
			}
		}

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert.isTrue(phase2Day1Left.toNumber() > 0 , 'user should be able to bought in limit');

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account2);
		assert.isTrue(phase2Day1Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	it('sale : should not allow user to buy in phase 2 day 1 out of limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});
		await saleInstance.setBlockTime(phase2StartAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert_throw(saleInstance.sendTransaction({from: account1, value: 1000E18}));

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert.isTrue(phase2Day1Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	it('sale : should allow one user not second to buy in phase 2 day 1 in of limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		await saleInstance.setBlockTime(phase2StartAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day1Limit = await saleInstance.getPhase2Day1Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account2);

			if((balance.toNumber() + phase2Batch) > phase2Day1Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account2, value: 1000E18});
			}
		}

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		await saleInstance.sendTransaction({from: account1, value: 250E18});

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account1);
		assert.isTrue(phase2Day1Left.toNumber() == 0 , 'user should be able to bought fully');

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account2);
		assert_throw(saleInstance.sendTransaction({from: account2, value: 1000E18}));

		var phase2Day1Left = await saleInstance.getPhase2Day1Left(account2);
		assert.isTrue(phase2Day1Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	it('sale : should allow user to buy in phase 2 day 2 in limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		await saleInstance.setBlockTime(phase2EndAt);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);
			// console.log('Balance ACX' , i , toFixed(balance) , toFixed(phase2Day2Limit) , toFixed(phase2Batch) , toFixed(balance.toNumber() + phase2Batch));
			
			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		// console.log(toFixed(phase2Day2Left));
		assert.isTrue(phase2Day2Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	it('sale : should allow user to buy in phase 2 day 2 in limit on border' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});
		
		await saleInstance.setBlockTime(phase2StartAt + day);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		await saleInstance.sendTransaction({from: account1, value: 500E18});

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		assert.equal(phase2Day2Left.toNumber() , 0 , 'all balance should be bought');	
	});

	it('sale : should allow two user to buy in phase 2 day 2 in limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		var account3 = accounts[7];
		await saleInstance.setWhitelist(account3 , true , {from: owner});

		var account4 = accounts[8];
		await saleInstance.setWhitelist(account4 , true , {from: owner});
		
		await saleInstance.setBlockTime(phase2StartAt + day);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account2);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account2, value: 1000E18});
			}
		}

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		assert.isTrue(phase2Day2Left.toNumber() > 0 , 'user should be able to bought in limit');

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account2);
		assert.isTrue(phase2Day2Left.toNumber() > 0 , 'user should be able to bought in limit');		
	});

	it('sale : should not allow user to buy in phase 2 day 2 out of limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		await saleInstance.setBlockTime(phase2StartAt + day);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		assert_throw(saleInstance.sendTransaction({from: account1, value: 1000E18}));

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		assert.isTrue(phase2Day2Left.toNumber() > 0 , 'user should be able to bought in limit');		
	});

	it('sale : should allow one user not second to buy in phase 2 day 2 in of limit' , async () => {
		var account1 = accounts[5];
		await saleInstance.setWhitelist(account1 , true , {from: owner});

		var account2 = accounts[6];
		await saleInstance.setWhitelist(account2 , true , {from: owner});

		var account3 = accounts[7];
		await saleInstance.setWhitelist(account3 , true , {from: owner});

		var account4 = accounts[8];
		await saleInstance.setWhitelist(account4 , true , {from: owner});

		await saleInstance.setBlockTime(phase2StartAt + day);

		var totalTokenSold = await saleInstance.totalTokenSold.call();
		var phase2Day2Limit = await saleInstance.getPhase2Day2Limit.call();
		var phase2Batch = 40000000E18;

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account1);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account1, value: 1000E18});
			}
		}

		for(var i = 0 ; true ; i ++) {
			var balance = await getTokenBalance(account2);

			if((balance.toNumber() + phase2Batch) > phase2Day2Limit.toNumber()) {
				break;
			} else {
				await saleInstance.sendTransaction({from: account2, value: 1000E18});
			}
		}

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		await saleInstance.sendTransaction({from: account1, value: 250E18});

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account1);
		assert.isTrue(phase2Day2Left.toNumber() == 0 , 'user should be able to bought fully');

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account2);
		assert_throw(saleInstance.sendTransaction({from: account2, value: 1000E18}));

		var phase2Day2Left = await saleInstance.getPhase2Day2Left(account2);
		assert.isTrue(phase2Day2Left.toNumber() > 0 , 'user should be able to bought in limit');
	});

	// close 
	it('sale : should close the sale contract' , async () => {
		var closeBefore = await saleInstance.isClose.call();
		assert.equal(closeBefore , false , 'should not be closed');

		await saleInstance.close({from: owner});	

		var closeAfter = await saleInstance.isClose.call();
		assert.equal(closeAfter , true , 'should be closed');
	});

	it('sale : should not allow to buy when closed' , async () => {
		await saleInstance.close({from: owner});	
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		assert_throw(saleInstance.sendTransaction({from: account, value: 1E18}));
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() , 'balance should not be increased');		
	});

	it('sale : should pause the sale contract' , async () => {
		var pauseBefore = await saleInstance.isPaused.call();
		assert.equal(pauseBefore , false , 'should not be paused');
		
		await saleInstance.pause({from: owner});	

		var pauseAfter = await saleInstance.isPaused.call();
		assert.equal(pauseAfter , true , 'should be paused');
	});

	it('sale : should resume the sale contract' , async () => {
		var pauseBefore = await saleInstance.isPaused.call();
		assert.equal(pauseBefore , false , 'should not be paused');
		
		await saleInstance.pause({from: owner});	

		var pauseAfter = await saleInstance.isPaused.call();
		assert.equal(pauseAfter , true , 'should be paused');		

		var pauseBefore = await saleInstance.isPaused.call();
		assert.equal(pauseBefore , true , 'should not be paused');
		
		await saleInstance.resume({from: owner});	

		var pauseAfter = await saleInstance.isPaused.call();
		assert.equal(pauseAfter , false , 'should be paused');		
	});

	it('sale : should not allow to buy when paused' , async () => {
		await saleInstance.pause({from: owner});	
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		assert_throw(saleInstance.sendTransaction({from: account, value: 1E18}));
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() , 'balance should not be increased');		
	});

	it('sale : should not allow to buy when resumed' , async () => {
		await saleInstance.pause({from: owner});	
		await saleInstance.resume({from: owner});
		var account = accounts[3];

		var balanceBefore = await tokenInstance.balanceOf.call(account);
		await saleInstance.setBlockTime(phase3StartAt);
		await saleInstance.sendTransaction({from: account, value: 1E18});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		
		assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 40000E18 , 'balance should be increased');		
	});

	it('sale : should match the phase3Hardcap balance' , async () => {
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var balance = await getTokenBalance(saleInstance.address);

		assert.isTrue(balance.toNumber() >= phase3Hardcap.toNumber() , 'sale instance should have enough balance');
	});

	it('sale : should match the tokenVestingAmount balance' , async () => {
		var tokenVestingAmount = await saleInstance.tokenVestingAmount.call();
		var balance = await getTokenBalance(saleInstance.address);

		assert.isTrue(balance.toNumber() >= tokenVestingAmount.toNumber() , 'sale instance should have enough balance');
	});

	it('sale : should match the total balance' , async () => {
		var phase3Hardcap = await saleInstance.phase3Hardcap.call();
		var tokenVestingAmount = await saleInstance.tokenVestingAmount.call();

		var balance = await getTokenBalance(saleInstance.address);
		var balanceTotal = phase3Hardcap.toNumber() + tokenVestingAmount.toNumber();

		assert.isTrue(approxEqual(balance.toNumber() , balanceTotal) , 'sale instance should have enough balance');
	});

	it('sale : should distribute ethers' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var exchangeEtherShare = await saleInstance.exchangeEtherShare.call();
		var teamEtherShare = await saleInstance.teamEtherShare.call();
		var incentiveEtherShare = await saleInstance.incentiveEtherShare.call();

		var exchangeEtherWallet = await saleInstance.exchangeEtherWallet.call();
		var teamEtherWallet = await saleInstance.teamEtherWallet.call();
		var incentiveEtherWallet = await saleInstance.incentiveEtherWallet.call();

		var balanceBefore = await getBalance(saleInstance.address);
		var exchangeEtherWalletBefore = await getBalance(exchangeEtherWallet);
		var teamEtherWalletBefore = await getBalance(teamEtherWallet);
		var incentiveEtherWalletBefore = await getBalance(incentiveEtherWallet);

		await saleInstance.distributeEthers({from: owner});

		var balanceAfter = await getBalance(saleInstance.address);
		var exchangeEtherWalletAfter = await getBalance(exchangeEtherWallet);
		var teamEtherWalletAfter = await getBalance(teamEtherWallet);
		var incentiveEtherWalletAfter = await getBalance(incentiveEtherWallet);

		// console.log(exchangeEtherShare.toNumber());
		// console.log(teamEtherShare.toNumber());
		// console.log(incentiveEtherShare.toNumber());

		// console.log((balanceAfter.toNumber()) , (balanceBefore.toNumber()));
		// console.log((exchangeEtherWalletAfter.toNumber()) , (exchangeEtherWalletBefore.toNumber()));
		// console.log((teamEtherWalletAfter.toNumber()) , (teamEtherWalletBefore.toNumber()));
		// console.log((incentiveEtherWalletAfter.toNumber()) , (incentiveEtherWalletBefore.toNumber()));

		assert.equal(balanceAfter.toNumber() , 0 , 'sale balance should be zero');
		assert.isTrue(approxEqual(exchangeEtherWalletAfter.toNumber() ,exchangeEtherWalletBefore.toNumber() + (balanceBefore.toNumber() * exchangeEtherShare.toNumber() / 100)) , 'exchange ether wallet should change');
		assert.isTrue(approxEqual(teamEtherWalletAfter.toNumber() ,teamEtherWalletBefore.toNumber() + (balanceBefore.toNumber() * teamEtherShare.toNumber() / 100)) , 'team ether wallet should change');
		assert.isTrue(approxEqual(incentiveEtherWalletAfter.toNumber() ,incentiveEtherWalletBefore.toNumber() + (balanceBefore.toNumber() * incentiveEtherShare.toNumber() / 100)) , 'incentive ether wallet should change');
	});

	it('sale : should not distribute ethers if soft cap not reached' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , false);
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var exchangeEtherWallet = await saleInstance.exchangeEtherWallet.call();
		var teamEtherWallet = await saleInstance.teamEtherWallet.call();
		var incentiveEtherWallet = await saleInstance.incentiveEtherWallet.call();

		var balanceBefore = await getBalance(saleInstance.address);
		var exchangeEtherWalletBefore = await getBalance(exchangeEtherWallet);
		var teamEtherWalletBefore = await getBalance(teamEtherWallet);
		var incentiveEtherWalletBefore = await getBalance(incentiveEtherWallet);

		assert_throw(saleInstance.distributeEthers({from: owner}));

		var balanceAfter = await getBalance(saleInstance.address);
		var exchangeEtherWalletAfter = await getBalance(exchangeEtherWallet);
		var teamEtherWalletAfter = await getBalance(teamEtherWallet);
		var incentiveEtherWalletAfter = await getBalance(incentiveEtherWallet);

		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'sale balance should be same');
		assert.equal(exchangeEtherWalletAfter.toNumber() , exchangeEtherWalletBefore.toNumber() , 'exchange balance should be same');
		assert.equal(teamEtherWalletAfter.toNumber() , teamEtherWalletBefore.toNumber() , 'team ether balance should be same');
		assert.equal(incentiveEtherWalletAfter.toNumber() , incentiveEtherWalletBefore.toNumber() , 'icentive balance should be same');
	});

	it('sale : should not distribute ethers if end date not reached' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);

		var exchangeEtherWallet = await saleInstance.exchangeEtherWallet.call();
		var teamEtherWallet = await saleInstance.teamEtherWallet.call();
		var incentiveEtherWallet = await saleInstance.incentiveEtherWallet.call();

		var balanceBefore = await getBalance(saleInstance.address);
		var exchangeEtherWalletBefore = await getBalance(exchangeEtherWallet);
		var teamEtherWalletBefore = await getBalance(teamEtherWallet);
		var incentiveEtherWalletBefore = await getBalance(incentiveEtherWallet);

		assert_throw(saleInstance.distributeEthers({from: owner}));

		var balanceAfter = await getBalance(saleInstance.address);
		var exchangeEtherWalletAfter = await getBalance(exchangeEtherWallet);
		var teamEtherWalletAfter = await getBalance(teamEtherWallet);
		var incentiveEtherWalletAfter = await getBalance(incentiveEtherWallet);

		assert.equal(balanceAfter.toNumber() , balanceBefore.toNumber() , 'sale balance should be same');
		assert.equal(exchangeEtherWalletAfter.toNumber() , exchangeEtherWalletBefore.toNumber() , 'exchange balance should be same');
		assert.equal(teamEtherWalletAfter.toNumber() , teamEtherWalletBefore.toNumber() , 'team ether balance should be same');
		assert.equal(incentiveEtherWalletAfter.toNumber() , incentiveEtherWalletBefore.toNumber() , 'icentive balance should be same');
	});

	it('sale : should distribute token vesting contracts' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		await saleInstance.distributeTokens({from: owner});
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();

		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');
	});

	it('sale : should distribute token contracts' , async () => {
		var account = accounts[3];	

		await saleInstance.setBlockTime(phase3BetweenAt);
		await reachSoftcap(account , true);
		await saleInstance.setBlockTime(phase3EndAt + day);	

		var exchangeWalletCount = await vestingInstance.exchangeWalletCount.call();
		var exchangeWallets = [];
		var exchangeAmounts = [];
		var exchangeAmountsBefore = [];
		var exchangeBalanceBefore = [];
		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			exchangeWallets[i] = await vestingInstance.exchangeWallets.call(i);
			exchangeAmounts[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeAmountsBefore[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeBalanceBefore[i] = await getTokenBalance(exchangeWallets[i]);
		}

		var teamWalletCount = await vestingInstance.teamWalletCount.call();
		var teamWallets = [];
		var teamAmounts = [];
		var teamAmountsBefore = [];
		var teamBalanceBefore = [];
		for(var i = 0 ; i < teamWalletCount ; i ++) {
			teamWallets[i] = await vestingInstance.teamWallets.call(i);
			teamAmounts[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamAmountsBefore[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamBalanceBefore[i] = await getTokenBalance(teamWallets[i]);
		}

		var advisorWalletCount = await vestingInstance.advisorWalletCount.call();
		var advisorWallets = [];
		var advisorAmounts = [];
		var advisorAmountsBefore = [];
		var advisorBalanceBefore = [];
		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			advisorWallets[i] = await vestingInstance.advisorWallets.call(i);
			advisorAmounts[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorAmountsBefore[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorBalanceBefore[i] = await getTokenBalance(advisorWallets[i]);
		}

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		await saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var exchangeAmountsAfter = [];
		var exchangeBalanceAfter = [];
		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			exchangeAmountsAfter[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeBalanceAfter[i] = await getTokenBalance(exchangeWallets[i]);
		}

		var teamAmountsAfter = [];
		var teamBalanceAfter = [];
		for(var i = 0 ; i < teamWalletCount ; i ++) {
			teamAmountsAfter[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamBalanceAfter[i] = await getTokenBalance(teamWallets[i]);
		}

		var advisorAmountsAfter = [];
		var advisorBalanceAfter = [];
		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			advisorAmountsAfter[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorBalanceAfter[i] = await getTokenBalance(advisorWallets[i]);
		}

		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			assert.equal(exchangeAmountsAfter[i].toNumber() , 0 , 'exchange amount balance should be zero');
			assert.equal(exchangeBalanceAfter[i].toNumber() , exchangeBalanceBefore[i].toNumber() + exchangeAmountsBefore[i].toNumber() , 'wallets balance should increase');
		}

		for(var i = 0 ; i < teamWalletCount ; i ++) {
			var teamTokenAmounts = teamAmounts[i];
			var teamTokenAmountsBefore = teamAmountsBefore[i];
			var teamTokenAmountsAfter = teamAmountsAfter[i];

			var teamTokenBalanceBefore = teamBalanceBefore[i];
			var teamTokenBalanceAfter = teamBalanceAfter[i];

			var teamTokenBalance = teamTokenAmounts * 25 / 100;

			assert.isTrue(approxEqual(teamTokenBalanceAfter.toNumber() , teamTokenBalanceBefore.toNumber() + teamTokenBalance) , 'team wallet balance should increase by 25%');
			assert.isTrue(approxEqual(teamTokenAmountsAfter.toNumber() , teamTokenAmountsBefore.toNumber() - teamTokenBalance)  , 'team wallet balance should increase by 75%');
		}

		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			var advisorTokenAmounts = advisorAmounts[i];
			var advisorTokenAmountsBefore = advisorAmountsBefore[i];
			var advisorTokenAmountsAfter = advisorAmountsAfter[i];

			var advisorTokenBalanceBefore = advisorBalanceBefore[i];
			var advisorTokenBalanceAfter = advisorBalanceAfter[i];

			var advisorTokenBalance = advisorTokenAmounts * 25 / 100;

			assert.isTrue(approxEqual(advisorTokenBalanceAfter.toNumber() , advisorTokenBalanceBefore.toNumber() + advisorTokenBalance) , 'advisor wallet balance should increase by 25%');
			assert.isTrue(approxEqual(advisorTokenAmountsAfter.toNumber() , advisorTokenAmountsBefore.toNumber() - advisorTokenBalance)  , 'advisor wallet balance should increase by 75%');
		}
	});

	it('vesting : should not deploy access token vesting contract if not enough balance' , async () => {
		var account = accounts[3];	

		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var start = await vestingInstance.start.call();
		var cliff = await vestingInstance.cliff.call();
		var duration = await vestingInstance.duration.call();
		var time = await vestingInstance.getBlockTime.call();

		var exchangeWallet = await vestingInstance.exchangeWallets.call(0);
		var exchangeBalance = await vestingInstance.beneficiaries.call(exchangeWallet);
		var releasedAmount = await vestingInstance.released.call(exchangeWallet);
		var releasableAmount = await vestingInstance.releasableAmount.call(exchangeWallet);
		assert_throw(vestingInstance.release(exchangeWallet));

		var exchangeWalletCount = await vestingInstance.exchangeWalletCount.call();
		var exchangeWallets = [];
		var exchangeAmounts = [];
		var exchangeAmountsBefore = [];
		var exchangeBalanceBefore = [];
		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			exchangeWallets[i] = await vestingInstance.exchangeWallets.call(i);
			exchangeAmounts[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeAmountsBefore[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeBalanceBefore[i] = await getTokenBalance(exchangeWallets[i]);
		}

		var teamWalletCount = await vestingInstance.teamWalletCount.call();
		var teamWallets = [];
		var teamAmounts = [];
		var teamAmountsBefore = [];
		var teamBalanceBefore = [];
		for(var i = 0 ; i < teamWalletCount ; i ++) {
			teamWallets[i] = await vestingInstance.teamWallets.call(i);
			teamAmounts[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamAmountsBefore[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamBalanceBefore[i] = await getTokenBalance(teamWallets[i]);
		}

		var advisorWalletCount = await vestingInstance.advisorWalletCount.call();
		var advisorWallets = [];
		var advisorAmounts = [];
		var advisorAmountsBefore = [];
		var advisorBalanceBefore = [];
		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			advisorWallets[i] = await vestingInstance.advisorWallets.call(i);
			advisorAmounts[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorAmountsBefore[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorBalanceBefore[i] = await getTokenBalance(advisorWallets[i]);
		}		

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var exchangeAmountsAfter = [];
		var exchangeBalanceAfter = [];
		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			exchangeAmountsAfter[i] = await vestingInstance.beneficiaries.call(exchangeWallets[i]);
			exchangeBalanceAfter[i] = await getTokenBalance(exchangeWallets[i]);
		}

		var teamAmountsAfter = [];
		var teamBalanceAfter = [];
		for(var i = 0 ; i < teamWalletCount ; i ++) {
			teamAmountsAfter[i] = await vestingInstance.beneficiaries.call(teamWallets[i]);
			teamBalanceAfter[i] = await getTokenBalance(teamWallets[i]);
		}

		var advisorAmountsAfter = [];
		var advisorBalanceAfter = [];
		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			advisorAmountsAfter[i] = await vestingInstance.beneficiaries.call(advisorWallets[i]);
			advisorBalanceAfter[i] = await getTokenBalance(advisorWallets[i]);
		}

		for(var i = 0 ; i < exchangeWalletCount ; i ++) {
			assert.equal(exchangeAmountsAfter[i].toNumber() , 0 , 'exchange amount balance should be zero');
			assert.equal(exchangeBalanceAfter[i].toNumber() , exchangeBalanceBefore[i].toNumber() + exchangeAmountsBefore[i].toNumber() , 'wallets balance should increase');
		}

		for(var i = 0 ; i < teamWalletCount ; i ++) {
			var teamTokenAmounts = teamAmounts[i];
			var teamTokenAmountsBefore = teamAmountsBefore[i];
			var teamTokenAmountsAfter = teamAmountsAfter[i];

			var teamTokenBalanceBefore = teamBalanceBefore[i];
			var teamTokenBalanceAfter = teamBalanceAfter[i];

			var teamTokenBalance = teamTokenAmounts * 25 / 100;

			assert.isTrue(approxEqual(teamTokenBalanceAfter.toNumber() , teamTokenBalanceBefore.toNumber() + teamTokenBalance) , 'team wallet balance should increase by 25%');
			assert.isTrue(approxEqual(teamTokenAmountsAfter.toNumber() , teamTokenAmountsBefore.toNumber() - teamTokenBalance)  , 'team wallet balance should increase by 75%');
		}

		for(var i = 0 ; i < advisorWalletCount ; i ++) {
			var advisorTokenAmounts = advisorAmounts[i];
			var advisorTokenAmountsBefore = advisorAmountsBefore[i];
			var advisorTokenAmountsAfter = advisorAmountsAfter[i];

			var advisorTokenBalanceBefore = advisorBalanceBefore[i];
			var advisorTokenBalanceAfter = advisorBalanceAfter[i];

			var advisorTokenBalance = advisorTokenAmounts * 25 / 100;

			assert.isTrue(approxEqual(advisorTokenBalanceAfter.toNumber() , advisorTokenBalanceBefore.toNumber() + advisorTokenBalance) , 'advisor wallet balance should increase by 25%');
			assert.isTrue(approxEqual(advisorTokenAmountsAfter.toNumber() , advisorTokenAmountsBefore.toNumber() - advisorTokenBalance)  , 'advisor wallet balance should increase by 75%');
		}
	});
	
	it('sale : should not allow exchange user to call release tokens' , async () => {
		var account = accounts[3];	

		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var exchangeWallet = await vestingInstance.exchangeWallets.call(0);
		assert_throw(vestingInstance.release(exchangeWallet));
	});

	it('sale : should not allow team user to call release tokens' , async () => {
		var account = accounts[3];	

		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var teamWallet = await vestingInstance.teamWallets.call(0);
		var teamAmount = await vestingInstance.beneficiaries.call(teamWallet);
		
		var teamBalanceBefore = await getTokenBalance(teamWallet);
		await vestingInstance.release(teamWallet);
		var teamBalanceAfter = await getTokenBalance(teamWallet);

		// console.log(teamBalanceBefore.toNumber() , teamBalanceAfter.toNumber());
		assert.isTrue(teamBalanceAfter.toNumber() > teamBalanceBefore.toNumber() , 'balance should be increased');
	});

	it('sale : should allow advisor user to call release tokens' , async () => {
		var account = accounts[3];	

		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var advisorWallet = await vestingInstance.advisorWallets.call(0);
		var advisorAmount = await vestingInstance.beneficiaries.call(advisorWallet);
		
		var advisorBalanceBefore = await getTokenBalance(advisorWallet);
		await vestingInstance.release(advisorWallet);
		var advisorBalanceAfter = await getTokenBalance(advisorWallet);

		// console.log(advisorBalanceBefore.toNumber() , advisorBalanceAfter.toNumber());
		assert.isTrue(advisorBalanceAfter.toNumber() > advisorBalanceBefore.toNumber() , 'balance should be increased');
	});

	it('sale : should allow user to call release tokens only once per month' , async () => {
		var account = accounts[3];	

		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();
		
		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var teamWallet = await vestingInstance.teamWallets.call(0);
		var teamAmount = await vestingInstance.beneficiaries.call(teamWallet);
		
		var teamBalanceBefore = await getTokenBalance(teamWallet);
		await vestingInstance.release(teamWallet);
		var teamBalanceAfter = await getTokenBalance(teamWallet);

		// console.log(teamBalanceBefore.toNumber() , teamBalanceAfter.toNumber());
		assert.isTrue(teamBalanceAfter.toNumber() > teamBalanceBefore.toNumber() , 'balance should be increased');

		var teamBalanceBefore = await getTokenBalance(teamWallet);
		assert_throw(vestingInstance.release(teamWallet));
		var teamBalanceAfter = await getTokenBalance(teamWallet);

		// console.log(teamBalanceBefore.toNumber() , teamBalanceAfter.toNumber());
		assert.isTrue(teamBalanceAfter.toNumber() == teamBalanceBefore.toNumber() , 'balance should be unchanged');
	});

	it('sale : should allow user to call release tokens to full for all months' , async () => {
		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		await saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();

		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var teamWallet = await vestingInstance.teamWallets.call(0);
		var teamAmount = await vestingInstance.beneficiaries.call(teamWallet);
		var teamBalanceStart = await getTokenBalance(teamWallet);

		for(var i = 0 ; i < 36 ; i ++) {
			// console.log('----- loop no -----' , i);
			var teamBalanceBefore = await getTokenBalance(teamWallet);			
			// console.log('balance');
			await vestingInstance.setBlockTime(phase3EndAt + 1 + month + (month * i) , {from: owner});	
			// console.log('block time');
				
			var beneficiaryBalance = await vestingInstance.beneficiaries.call(teamWallet);
			// console.log('balance' , toFixed(beneficiaryBalance));

			var released = await vestingInstance.released.call(teamWallet);
			// console.log('released' , toFixed(released));

			var availableAmount = await vestingInstance.availableAmount.call(teamWallet);
			// console.log('availableAmount' , toFixed(availableAmount));

			// console.log('diff' , beneficiaryBalance.toNumber() - released.toNumber());

			var vestedAmount = await vestingInstance.vestedAmount.call(teamWallet);
			// console.log('vested' , toFixed(vestedAmount));
			
			var vestedAmountType = await vestingInstance.vestedAmountType.call(teamWallet);
			// console.log('vested type' , toFixed(vestedAmountType));
			
			var releasableAmount = await vestingInstance.releasableAmount.call(teamWallet);
			// console.log('releasable' , toFixed(releasableAmount));
			
			var vestingBalance = await getTokenBalance(vestingInstance.address);
			// console.log('vesting balance' , toFixed(vestingBalance));

			// console.log(toFixed(teamBalanceBefore) , i , toFixed(releasableAmount) , toFixed(vestedAmount) , vestedAmountType.toNumber() , vestingBalance.toNumber());
			await vestingInstance.release(teamWallet , {from: owner});
			var teamBalanceAfter = await getTokenBalance(teamWallet);			
			// console.log(toFixed(teamBalanceBefore) , toFixed(teamBalanceAfter) , toFixed(teamBalanceStart) , toFixed(teamAmount));
			assert.isTrue(teamBalanceAfter.toNumber() > teamBalanceBefore.toNumber() , 'balance should be increased');
		}

		var teamBalanceEnd = await getTokenBalance(teamWallet);

		assert.equal(teamBalanceEnd.toNumber() , teamBalanceStart.toNumber() + teamAmount.toNumber() , 'final balance should be increased');
	});

	it('sale : should allow owner to call revoke' , async () => {
		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();

		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var teamWallet = await vestingInstance.teamWallets.call(0);
		var teamAmount = await vestingInstance.beneficiaries.call(teamWallet);

		var revokedBefore = await vestingInstance.revoked.call(teamWallet);
		var ownerBalanceBefore = await getTokenBalance(owner);
		await vestingInstance.revoke(teamWallet , {from: owner});
		var ownerBalanceAfter = await getTokenBalance(owner);
		var revokedAfter = await vestingInstance.revoked.call(teamWallet);

		assert.equal(revokedBefore , false , 'revoked should be false before');
		assert.equal(revokedAfter , true , 'revoked should be true after');

		assert.isTrue(ownerBalanceAfter.toNumber() > ownerBalanceBefore.toNumber() , 'owner balance should be more');
	});

	it('sale : should allow user to claim only tokens before revoke' , async () => {
		await vestingInstance.setBlockTime(phase3EndAt + 1 + month , {from: owner});	

		var tokenVestingDistributedBefore = await saleInstance.tokenVestingDistributed.call();
		saleInstance.distributeTokens();
		var tokenVestingDistributedAfter = await saleInstance.tokenVestingDistributed.call();

		assert.equal(tokenVestingDistributedBefore , false , 'should not be distributed before');
		assert.equal(tokenVestingDistributedAfter , true , 'should be distributed after');

		var teamWallet = await vestingInstance.teamWallets.call(0);
		var teamAmount = await vestingInstance.beneficiaries.call(teamWallet);

		var teamBalanceBefore = await getTokenBalance(teamWallet);
		await vestingInstance.release(teamWallet);
		var teamBalanceAfter = await getTokenBalance(teamWallet);

		assert.isTrue(teamBalanceAfter.toNumber() > teamBalanceBefore.toNumber() , 'balance should be increased');

		var revokedBefore = await vestingInstance.revoked.call(teamWallet);
		var ownerBalanceBefore = await getTokenBalance(owner);
		await vestingInstance.revoke(teamWallet , {from: owner});
		var ownerBalanceAfter = await getTokenBalance(owner);
		var revokedAfter = await vestingInstance.revoked.call(teamWallet);

		assert.equal(revokedBefore , false , 'revoked should be false before');
		assert.equal(revokedAfter , true , 'revoked should be true after');

		assert.isTrue(ownerBalanceAfter.toNumber() > ownerBalanceBefore.toNumber() , 'owner balance should be more');

		await vestingInstance.setBlockTime(phase3EndAt + 2 + month + month, {from: owner});	

		var teamBalanceBefore = await getTokenBalance(teamWallet);
		assert_throw(vestingInstance.release(teamWallet));
		var teamBalanceAfter = await getTokenBalance(teamWallet);

		// console.log(teamBalanceAfter.toNumber() , teamBalanceBefore.toNumber());
		assert.isTrue(teamBalanceAfter.toNumber() == teamBalanceBefore.toNumber() , 'balance should not sbe increased');
	}); 

	it('sale : should match the token vesting contract address' , async () => {
		var vestingContractAddress = await saleInstance.tokenVesting.call();
		assert.equal(vestingContractAddress , vestingInstance.address , 'address should match');		
	}); 
});
