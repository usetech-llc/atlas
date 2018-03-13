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

contract('Governance Relay' , (accounts) => {
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

	it('governance : relay : should update decision module in relay contract if quorum reached' , async () => {
		var counter = await governanceInstance.cycleCounter.call();
		var decisionModuleInstanceNext = await DecisionModule.new(tokenInstance.address , {from: owner});
	 await decisionModuleInstanceNext.setRelay(relayInstance.address , {from : owner});

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await chooseGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await decideGovernance(accounts, governanceInstance , decisionModuleInstanceNext , true);
		await closeGovernance(accounts, governanceInstance , decisionModuleInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstanceNext.address , 'decisionModuleAddress should match');
	});

	it('governance : relay : should not update decision module in relay contract if quorum not reached' , async () => {
		var counter = await governanceInstance.cycleCounter.call();
		var decisionModuleInstanceNext = await DecisionModule.new(tokenInstance.address , {from: owner});
	 await decisionModuleInstanceNext.setRelay(relayInstance.address , {from : owner});

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await chooseGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await decideGovernance(accounts, governanceInstance , decisionModuleInstanceNext , false);
		await closeGovernance(accounts, governanceInstance , decisionModuleInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');
	});

	it('governance : relay : should not update decision module in relay contract from outside' , async () => {
		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');

		assert_throw(relayInstance.setDecisionModule(accounts[0] , {from: owner}));

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');
	});

	it('governance : relay : should update governance in relay contract if quorum reached' , async () => {
		// first do it for decision module
		var counter = await governanceInstance.cycleCounter.call();
		assert.equal(counter , 2 , 'counter should match');
		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle , 1 , 'counter should match');

		var counter = await governanceInstance.cycleCounter.call();
		var decisionModuleInstanceNext = await DecisionModule.new(tokenInstance.address , {from: owner});
		await decisionModuleInstanceNext.setRelay(relayInstance.address , {from : owner});

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await chooseGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await decideGovernance(accounts, governanceInstance , decisionModuleInstanceNext , true);
		await closeGovernance(accounts, governanceInstance , decisionModuleInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstanceNext.address , 'decisionModuleAddress should match');

		// try governance
		var counter = await governanceInstance.cycleCounter.call();
		assert.equal(counter , 3 , 'counter should match');
		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle , 0 , 'counter should match');

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		await governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstance.address , 'governanceAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);
		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , true);
		await closeGovernance(accounts, governanceInstance , governanceInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstanceNext.address , 'governanceAddress should match');
	});

	it('governance : relay : should not update governance in relay contract if quorum not reached' , async () => {
		// first do it for decision module
		var counter = await governanceInstance.cycleCounter.call();
		assert.equal(counter , 2 , 'counter should match');
		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle , 1 , 'counter should match');

		var counter = await governanceInstance.cycleCounter.call();
		var decisionModuleInstanceNext = await DecisionModule.new(tokenInstance.address , {from: owner});
	 await decisionModuleInstanceNext.setRelay(relayInstance.address , {from : owner});

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await chooseGovernance(accounts, governanceInstance , decisionModuleInstanceNext);
		await decideGovernance(accounts, governanceInstance , decisionModuleInstanceNext , false);
		await closeGovernance(accounts, governanceInstance , decisionModuleInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
		assert.equal(decisionModuleAddress , decisionModuleInstance.address , 'decisionModuleAddress should match');
		
		// try governance
		var counter = await governanceInstance.cycleCounter.call();
		assert.equal(counter , 3 , 'counter should match');
		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle , 0 , 'counter should match');

		var governanceInstanceNext = await Governance.new(tokenInstance.address , {from: owner});
		await governanceInstanceNext.setRelay(relayInstance.address , {from : owner});

		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstance.address , 'governanceAddress should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await submitGovernance(accounts, governanceInstance , governanceInstanceNext);
		await chooseGovernance(accounts, governanceInstance , governanceInstanceNext);
		await decideGovernance(accounts, governanceInstance , governanceInstanceNext , false);
		await closeGovernance(accounts, governanceInstance , governanceInstanceNext);

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstance.address , 'governanceAddress should match');
	});

	it('governance : relay : should not update governance in relay contract from outside' , async () => {
		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstance.address , 'governanceAddress should match');

		assert_throw(relayInstance.setGovernance(accounts[0] , {from: owner}));

		var governanceAddress = await relayInstance.governanceAddress.call();
		assert.equal(governanceAddress , governanceInstance.address , 'governanceAddress should match');
	});
});