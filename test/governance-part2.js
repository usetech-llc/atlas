'use strict';
var AccessToken = artifacts.require("./AccessToken.sol");
var Governance = artifacts.require("./Governance.sol");
var DecisionModule = artifacts.require("./DecisionModule.sol");
var Relay = artifacts.require("./Relay.sol");

var assert_throw = require('./helpers/utils').assert_throw;
var promisify = require('./helpers/utils').promisify;
var getBalance = require('./helpers/utils').getBalance;
var makeNumber = require('./helpers/utils').makeNumber;

var setOwner = require('./governance-helper').setOwner;
var setTokenInstance = require('./governance-helper').setTokenInstance;
var setGovernanceInstance = require('./governance-helper').setGovernanceInstance;
var setDecisionModuleInstance = require('./governance-helper').setDecisionModuleInstance;
var setRelayInstance = require('./governance-helper').setRelayInstance;

var submitGovernance = require('./governance-helper').submitGovernance;
var chooseGovernance = require('./governance-helper').chooseGovernance;
var decideGovernance = require('./governance-helper').decideGovernance;
var closeGovernance = require('./governance-helper').closeGovernance;

var tokenInstance;
var governanceInstance;
var decisionModuleInstance;
var relayInstance;

var owner, wallet;

var day = 60 * 60 * 24;
var month = day * 30;
var year = day * 365;

contract('Governance' , (accounts) => {
	owner = accounts[0];
	wallet = accounts[1];
	
	beforeEach(async () => {
		// deploy token contracts
		tokenInstance = await AccessToken.new({from: owner});

		// deploy governance contracts	
		governanceInstance = await Governance.new(tokenInstance.address , {from: owner});
		decisionModuleInstance = await DecisionModule.new(tokenInstance.address , {from: owner});
		relayInstance = await Relay.new(tokenInstance.address , governanceInstance.address , decisionModuleInstance.address , {from: owner});
			
		// update governance relay	
		await tokenInstance.setRelay(relayInstance.address , {from : owner});
		await governanceInstance.setRelay(relayInstance.address , {from : owner});
		await decisionModuleInstance.setRelay(relayInstance.address , {from : owner});

		// mint some tokens to owner
		await tokenInstance.mint(owner , 100000E18 , {from: owner});
		await tokenInstance.mint(accounts[5] , 100E18 , {from: owner});
		await tokenInstance.mint(accounts[6] , 100E18 , {from: owner});

		setOwner(owner);
		setTokenInstance(tokenInstance);
		setGovernanceInstance(governanceInstance);
		setDecisionModuleInstance(decisionModuleInstance);
		setRelayInstance(relayInstance);
	});

	it('governance : choose : part2 : should sub weight if token ownership is sent' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(governanceInstanceNext.address , {from: account});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() + balance.toNumber() , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() + balance.toNumber() , 'voterWeight should match');


		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert_throw(tokenInstance.transfer(accounts[11] , 10E18 , {from: account}));
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() - balanceDiff , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() - balanceDiff , 'voterWeight should match');
	});

	it('governance : choose : part2 : should add weight if token ownership is received' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(governanceInstanceNext.address , {from: account});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() + balance.toNumber() , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() + balance.toNumber() , 'voterWeight should match');


		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert_throw(tokenInstance.transfer(account , 10E18 , {from: owner}));
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber()	 , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() , 'voterWeight should match');
	});

	it('governance : choose : part2 : should sub and add weight if token ownership is send and received' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);

		var sender = accounts[10];
		await tokenInstance.transfer(sender , 100E18 , {from: owner});
		var senderBalance = await tokenInstance.balanceOf.call(sender);

		var receiver = accounts[11];
		await tokenInstance.transfer(receiver , 100E18 , {from: owner});
		var receiverBalance = await tokenInstance.balanceOf.call(receiver);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var senderWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , sender);
		var receiverWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , receiver);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(governanceInstanceNext.address , {from: sender});
		await governanceInstance.choose(governanceInstanceNext.address , {from: receiver});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var senderWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , sender);
		var receiverWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , receiver);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() + senderBalance.toNumber() + receiverBalance.toNumber() , 'candidateWeight should match');
		assert.equal(senderWeightAfter.toNumber() , senderWeightBefore.toNumber() + senderBalance.toNumber() , 'senderWeight should match');
		assert.equal(receiverWeightAfter.toNumber() , receiverWeightBefore.toNumber() + receiverBalance.toNumber() , 'receiverWeight should match');


		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var senderWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , sender);
		var receiverWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , receiver);

		assert_throw(tokenInstance.transfer(receiver , 10E18 , {from: sender}));
		var senderBalanceAfter = await tokenInstance.balanceOf.call(sender);
		var senderBalanceDiff = senderBalance.toNumber() - senderBalanceAfter.toNumber();
		var receiverBalanceAfter = await tokenInstance.balanceOf.call(receiver);
		var receiverBalanceDiff = receiverBalance.toNumber() - receiverBalanceAfter.toNumber();

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var senderWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , sender);
		var receiverWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , receiver);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() - senderBalanceDiff - receiverBalanceDiff , 'candidateWeight should match');
		assert.equal(senderWeightAfter.toNumber() , senderWeightBefore.toNumber() - senderBalanceDiff , 'senderWeight should match');
		assert.equal(receiverWeightAfter.toNumber() , receiverWeightBefore.toNumber() - receiverBalanceDiff , 'receiverWeight should match');
	});	

	it('governance : decide : part2 : should sub weight if token ownership is sent' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);
		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , true);

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balance.toNumber() , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() + balance.toNumber() , 'voterSupport should match');


		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await tokenInstance.transfer(accounts[11] , 10E18 , {from: account});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() - balanceDiff , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() - balanceDiff , 'voterSupport should match');
	});

	it('governance : decide : part2 : should add weight if token ownership is received' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);
		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , true);

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balance.toNumber() , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() + balance.toNumber() , 'voterSupport should match');


		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await tokenInstance.transfer(account , 10E18 , {from: owner});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() , 'voterSupport should match');


		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decideSafe({from: account});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() - balanceDiff , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() - balanceDiff , 'voterSupport should match');
	});

	it('governance : decide : part2 : should sub and add weight if token ownership is send and received' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);
		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , true);

		var sender = accounts[10];
		await tokenInstance.transfer(sender , 100E18 , {from: owner});
		var senderBalance = await tokenInstance.balanceOf.call(sender);

		var receiver = accounts[11];
		await tokenInstance.transfer(receiver , 100E18 , {from: owner});
		var receiverBalance = await tokenInstance.balanceOf.call(receiver);

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var senderWeightBefore = await governanceInstance.finalistSupporters.call(counter , sender);
		var receiverWeightBefore = await governanceInstance.finalistSupporters.call(counter , receiver);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: sender});
		await governanceInstance.decide({from: receiver});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var senderWeightAfter = await governanceInstance.finalistSupporters.call(counter , sender);
		var receiverWeightAfter = await governanceInstance.finalistSupporters.call(counter , receiver);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + senderBalance.toNumber() + receiverBalance.toNumber() , 'finalistSupport should match');
		assert.equal(senderWeightAfter.toNumber() , senderWeightBefore.toNumber() + senderBalance.toNumber() , 'senderWeight should match');
		assert.equal(receiverWeightAfter.toNumber() , receiverWeightBefore.toNumber() + receiverBalance.toNumber() , 'receiverWeight should match');


		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var senderWeightBefore = await governanceInstance.finalistSupporters.call(counter , sender);
		var receiverWeightBefore = await governanceInstance.finalistSupporters.call(counter , receiver);

		await tokenInstance.transfer(receiver , 10E18 , {from: sender});
		var senderBalanceAfter = await tokenInstance.balanceOf.call(sender);
		var senderBalanceDiff = senderBalance.toNumber() - senderBalanceAfter.toNumber();
		var receiverBalanceAfter = await tokenInstance.balanceOf.call(receiver);
		var receiverBalanceDiff = receiverBalance.toNumber() - receiverBalanceAfter.toNumber();

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var senderWeightAfter = await governanceInstance.finalistSupporters.call(counter , sender);
		var receiverWeightAfter = await governanceInstance.finalistSupporters.call(counter , receiver);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() - senderBalanceDiff , 'finalistSupport should match');
		assert.equal(senderWeightAfter.toNumber() , senderWeightBefore.toNumber() - senderBalanceDiff , 'senderWeight should match');
		assert.equal(receiverWeightAfter.toNumber() , receiverWeightBefore.toNumber() , 'receiverWeight should match');


		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decideSafe({from: receiver});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var senderWeightAfter = await governanceInstance.finalistSupporters.call(counter , sender);
		var receiverWeightAfter = await governanceInstance.finalistSupporters.call(counter , receiver);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() - senderBalanceDiff - receiverBalanceDiff , 'finalistSupport should match');
		assert.equal(senderWeightAfter.toNumber() , senderWeightBefore.toNumber() - senderBalanceDiff , 'senderWeight should match');
		assert.equal(receiverWeightAfter.toNumber() , receiverWeightBefore.toNumber() - receiverBalanceDiff , 'receiverWeight should match');
	});	

	it('governance : submit : part2 : should not weight if token ownership is sent before choose and decide' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		await tokenInstance.transfer(accounts[11] , 10E18 , {from: account});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(governanceInstanceNext.address , {from: account});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() + balance.toNumber() - balanceDiff , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() + balance.toNumber() - balanceDiff , 'voterWeight should match');
	});

	it('governance : submit : part2 : should not weight if token ownership is sent after choose and decide' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		var account = accounts[10];
		await tokenInstance.transfer(account , 100E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account);

		await tokenInstance.transfer(accounts[11] , 10E18 , {from: account});
		var balanceAfter = await tokenInstance.balanceOf.call(account);
		var balanceDiff = balance.toNumber() - balanceAfter.toNumber();

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(governanceInstanceNext.address , {from: account});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() + balance.toNumber() - balanceDiff , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() + balance.toNumber() - balanceDiff , 'voterWeight should match');

		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , true);

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balance.toNumber() - balanceDiff , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() + balance.toNumber() - balanceDiff , 'voterSupport should match');

		await closeGovernance(accounts, governanceInstance , governanceInstanceNext);

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightBefore = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var voterSupportBefore = await governanceInstance.finalistSupporters.call(counter , account);

		await tokenInstance.transfer(accounts[11] , 10E18 , {from: account});

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , governanceInstanceNext.address);
		var voterWeightAfter = await governanceInstance.candidateVoters.call(counter , governanceInstanceNext.address , account);

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var voterSupportAfter = await governanceInstance.finalistSupporters.call(counter , account);

		assert.equal(candidateWeightAfter.toNumber() , candidateWeightBefore.toNumber() , 'candidateWeight should match');
		assert.equal(voterWeightAfter.toNumber() , voterWeightBefore.toNumber() , 'voterWeight should match');
		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() , 'finalistSupport should match');
		assert.equal(voterSupportAfter.toNumber() , voterSupportBefore.toNumber() , 'voterSupport should match');
	});

	it('governance : choose : part2 : should move weight if vote is changed' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		var contract1account2WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account2);

		var contract2WeightBefore = await governanceInstance.candidateWeight.call(counter , contract2);
		var contract2account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
		var contract2account2WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account2);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});
		await governanceInstance.choose(contract1 , {from: account2});

		var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		var contract1account2WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account2);

		var contract2WeightAfter = await governanceInstance.candidateWeight.call(counter , contract2);
		var contract2account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
		var contract2account2WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account2);

		assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'contract1Weight should match');
		assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1.toNumber()  , 'contract1account1Weight should match');
		assert.equal(contract1account2WeightAfter.toNumber() , contract1account2WeightBefore.toNumber() + balanceAccount2.toNumber() , 'contract1account2Weight should match');
		
		assert.equal(contract2WeightAfter.toNumber() , contract2WeightBefore.toNumber() , 'contract2Weight should match');
		assert.equal(contract2account1WeightAfter.toNumber() , contract2account1WeightBefore.toNumber() , 'contract2account1Weight should match');
		assert.equal(contract2account2WeightAfter.toNumber() , contract2account2WeightBefore.toNumber() , 'contract2account2Weight should match');



		// var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// var contract1account2WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account2);

		// var contract2WeightBefore = await governanceInstance.candidateWeight.call(counter , contract2);
		// var contract2account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
		// var contract2account2WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account2);

		// await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		// await governanceInstance.chooseSafe(contract2 , {from: account2});

		// var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// var contract1account2WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account2);

		// var contract2WeightAfter = await governanceInstance.candidateWeight.call(counter , contract2);
		// var contract2account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
		// var contract2account2WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account2);

		// assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() - balanceAccount2.toNumber() , 'contract1Weight should match');
		// assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber()  , 'contract1account1Weight should match');
		// assert.equal(contract1account2WeightAfter.toNumber() , contract1account2WeightBefore.toNumber() - balanceAccount2.toNumber() , 'contract1account2Weight should match');
		
		// assert.equal(contract2WeightAfter.toNumber() , contract2WeightBefore.toNumber() + balanceAccount2.toNumber() , 'contract2Weight should match');
		// assert.equal(contract2account1WeightAfter.toNumber() , contract2account1WeightBefore.toNumber() , 'contract2account1Weight should match');
		// assert.equal(contract2account2WeightAfter.toNumber() , contract2account2WeightBefore.toNumber() + balanceAccount2.toNumber() , 'contract2account2Weight should match');
	});

	it('governance : decide : part2 : should move weight if support is changed' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});
		await governanceInstance.choose(contract1 , {from: account2});

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);
		var finalistaccount2SupportBefore = await governanceInstance.finalistSupporters.call(counter , account2);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account1});
		await governanceInstance.decide({from: account2});		

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);
		var finalistaccount2SupportAfter = await governanceInstance.finalistSupporters.call(counter , account2);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balanceAccount1.toNumber() + balanceAccount2.toNumber()  , 'finalistSupport should match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistaccount1Support should match');
		assert.equal(finalistaccount2SupportAfter.toNumber() , finalistaccount2SupportBefore.toNumber() + balanceAccount2.toNumber() , 'finalistaccount2Support should match');


		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);
		var finalistaccount2SupportBefore = await governanceInstance.finalistSupporters.call(counter , account2);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decideSafe({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);
		var finalistaccount2SupportAfter = await governanceInstance.finalistSupporters.call(counter , account2);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() , 'finalistSupport should match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() , 'finalistaccount1Support should match');
		assert.equal(finalistaccount2SupportAfter.toNumber() , finalistaccount2SupportBefore.toNumber() , 'finalistaccount2Support should match');
	});

	it('governance : choose : part2 : should update weight to current balance for same ammendment' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.chooseSafe(contract1 , {from: account1});

		var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
	
		assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1Weight should match');
		assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1account1Weight should match');

		// var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		// var balanceAccount1New = await tokenInstance.balanceOf.call(account1);
		// var balanceAccount1Dif = balanceAccount1New.toNumber() - balanceAccount1.toNumber();
		
		// await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account1});

		// var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1Dif , 'contract1Weight should match');
		// assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1Dif , 'contract1account1Weight should match');
	});

	it('governance : decide : part2 : should update weight to current balance for same ammendment' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		
		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decideSafe({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balanceAccount1.toNumber()  , 'finalistSupport should match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistaccount1Support should match');

		
		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1New = await tokenInstance.balanceOf.call(account1);
		var balanceAccount1Dif = balanceAccount1New.toNumber() - balanceAccount1.toNumber();
		
		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decideSafe({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balanceAccount1Dif , 'finalistSupport should match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() + balanceAccount1Dif , 'finalistaccount1Support should match');
	});

	it('governance : choose : part2 : should update weight if vote is rescinded then recast for same ammendment' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
	
		assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1Weight should match');
		assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1account1Weight should match');



		// var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		// await governanceInstance.decline({from: account1});

		// var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
	
		// assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() - balanceAccount1.toNumber() , 'contract1Weight should match');
		// assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() - balanceAccount1.toNumber() , 'contract1account1Weight should match');


		// var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		// await governanceInstance.choose(contract1 , {from: account1});

		// var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1Weight should match');
		// assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1account1Weight should match');
	});

	it('governance : choose : part2 : should update weight if vote is rescinded then recast for diff ammendment' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account1});


		
		var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		var contract2WeightBefore = await governanceInstance.candidateWeight.call(counter , contract2);
		var contract2account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account1);

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		var contract2WeightAfter = await governanceInstance.candidateWeight.call(counter , contract2);
		var contract2account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
	
		assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1Weight should match');
		assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract1account1Weight should match');

		assert.equal(contract2WeightAfter.toNumber() , contract2WeightBefore.toNumber() , 'contract2Weight should match');
		assert.equal(contract2account1WeightAfter.toNumber() , contract2account1WeightBefore.toNumber() , 'contract2account1Weight should match');



		// var contract1WeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// var contract2WeightBefore = await governanceInstance.candidateWeight.call(counter , contract2);
		// var contract2account1WeightBefore = await governanceInstance.candidateVoters.call(counter , contract2 , account1);

		// await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		// await governanceInstance.chooseSafe(contract2 , {from: account1});

		// var contract1WeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		// var contract1account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);

		// var contract2WeightAfter = await governanceInstance.candidateWeight.call(counter , contract2);
		// var contract2account1WeightAfter = await governanceInstance.candidateVoters.call(counter , contract2 , account1);
	
		// assert.equal(contract1WeightAfter.toNumber() , contract1WeightBefore.toNumber() - balanceAccount1.toNumber() , 'contract1Weight should match');
		// assert.equal(contract1account1WeightAfter.toNumber() , contract1account1WeightBefore.toNumber() - balanceAccount1.toNumber() , 'contract1account1Weight should match');

		// assert.equal(contract2WeightAfter.toNumber() , contract2WeightBefore.toNumber() + balanceAccount1.toNumber() , 'contract2Weight should match');
		// assert.equal(contract2account1WeightAfter.toNumber() , contract2account1WeightBefore.toNumber()  + balanceAccount1.toNumber() , 'contract2account1Weight should match');

	});

	it('governance : decide : part2 : should update weight if vote is rescinded then recast' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistSupport shoud match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistaccount1Support shoud match');



		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.dither({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() - balanceAccount1.toNumber() , 'finalistSupport shoud match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() - balanceAccount1.toNumber() , 'finalistaccount1Support shoud match');



		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportBefore = await governanceInstance.finalistSupporters.call(counter , account1);

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		await governanceInstance.decide({from: account1});

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		var finalistaccount1SupportAfter = await governanceInstance.finalistSupporters.call(counter , account1);

		assert.equal(finalistSupportAfter.toNumber() , finalistSupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistSupport shoud match');
		assert.equal(finalistaccount1SupportAfter.toNumber() , finalistaccount1SupportBefore.toNumber() + balanceAccount1.toNumber() , 'finalistaccount1Support shoud match');
	});
});