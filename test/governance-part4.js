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
var pushGovernance = require('./governance-helper').pushGovernance;
var voteGovernance = require('./governance-helper').voteGovernance;
var unvoteGovernance = require('./governance-helper').unvoteGovernance;

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

	it('governance : part4 : finalist : should decide the finalist' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 110E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract1, account3, 110E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to first : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account3, 20E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to second : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await unvoteGovernance(accounts, governanceInstance, account1);
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract2 , 'finalist should match');

		// await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to second : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account4, 10E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to third : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await unvoteGovernance(accounts, governanceInstance, account2);
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to first : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account4, 30E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract3 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to third : using vote' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account4, 15E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await unvoteGovernance(accounts, governanceInstance, account1);
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract3 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist randomly on same votes' , async () => {

	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to first : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account2 , 20E18 , {from: owner});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract2 , 'finalist should match');		
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to second : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(owner , 20E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract2 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to second : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 15E18 , {from: owner});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to third : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(owner , 15E18 , {from: account2});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to first : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 30E18 , {from: owner});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract3 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to third : using transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account4, 15E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(owner , 20E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract3 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to first : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account2 , 20E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract2 , 'finalist should match');		
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to second : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account2 , 20E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract2 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to second : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 15E18 , {from: account2});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when second postion moves to third : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 15E18 , {from: account2});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract1 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when third postion moves to first : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 30E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract3 , 'finalist should match');
	});

	it('governance : part4 : finalist : should decide the finalist when first postion moves to third : using internal transfer' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[11];
		var contract2 = accounts[12];
		var contract3 = accounts[13];

		var account1 = accounts[15];
		var account2 = accounts[16];
		var account3 = accounts[17];
		var account4 = accounts[18];

		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await pushGovernance(accounts, governanceInstance, contract3, account3);

		await voteGovernance(accounts, governanceInstance, contract1, account1, 100E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract2, account2, 90E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account3, 80E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		await voteGovernance(accounts, governanceInstance, contract3, account4, 15E18);
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract1 , 'finalist should match');

		// await tokenInstance.transfer(account3 , 20E18 , {from: account1});
		// var finalist = await governanceInstance.finalist.call(counter);
		// assert.equal(finalist , contract3 , 'finalist should match');
	});
});