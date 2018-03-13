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

	/* BLOCK NUMBER METHODS */

	it('timestamped : should set blockNumber' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		await governanceInstance.setBlockNumber(2000000 , {from: owner});
		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.equal(blockNumber.toNumber() , 2000000 , 'blockNumber should be set');
	});

	it('timestamped : should get blockNumber' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.isTrue(blockNumber.toNumber() > 0 , 'blockNumber should be get');	
	});

	it('timestamped : should reset blockNumber' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		await governanceInstance.setBlockNumber(123 , {from: owner});
		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.equal(blockNumber.toNumber() , 123 , 'blockNumber should be set');

		await governanceInstance.setBlockNumber(0);
		var blockNumber = await governanceInstance.getBlockNumber.call();	
		assert.isTrue(blockNumber > 0 , 'blockNumber should be reset');
	});

	it('governance : initialize : should initialize contract to correct cycle' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		assert_throw(governanceInstance.candidates.call(counter , 0));
		
		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , 0 , 'finalist should be 0');

		var finalistWeight = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeight.toNumber() , 0 , 'finalistWeight should be 0');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , 0 , 'finalistSupport should be 0');

		var closed = await governanceInstance.closed.call(counter);
		assert.equal(closed , false , 'closed should be 0');

		// var decided = await governanceInstance.decided.call(counter);
		// assert.equal(decided , 0 , 'decided should be 0');

		// var decidedWeight = await governanceInstance.decidedWeight.call(counter);	
		// assert.equal(decidedWeight.toNumber() , 0 , 'decidedWeight should be 0');

		// var decidedSupport = await governanceInstance.decidedSupport.call(counter);
		// assert.equal(decidedSupport.toNumber() , 0 , 'decidedSupport should be 0');
	});

	it('governance : cycle : should return correct cycle' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should be 1');
	});

	it('governance : stage : should return correct stage' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 1 , 'stage should be 1');
		
		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 2 , 'stage should be 2');

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 3 , 'stage should be 3');

		await governanceInstance.setBlockNumber(166666 * 4 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 5 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 6 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 1 , 'stage should be 1');

		await governanceInstance.setBlockNumber(166666 * 8 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 2 , 'stage should be 2');

		await governanceInstance.setBlockNumber(166666 * 9 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 3 , 'stage should be 3');

		await governanceInstance.setBlockNumber(166666 * 10 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

	});

	/* SUBMIT CANDIDATE */	
	it('governance : submit : should allow adding candidate during submission period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwnerBefore = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerBefore , 0 , 'candidateOwner should be false');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateOwnerAfter = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerAfter , contract1 , 'candidateOwner should be false');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , 1 , 'candidateWeight should be 0');
	});

	it('governance : submit : should allow submission the candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwnerBefore = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerBefore , 0 , 'candidateOwner should be false');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		// var candidateIndexAfter = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndexAfter.toNumber() , 0 , 'candidateIndex should match');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateOwnerAfter = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerAfter , contract1 , 'candidateOwner should be false');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , 1 , 'candidateWeight should be 0');
	});

	it('governance : submit : should allow submission the two candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwnerBefore = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerBefore , 0 , 'candidateOwner should be false');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateIndexAfter = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndexAfter.toNumber() , 0 , 'candidateIndex should match');

		// var candidateOwnerAfter = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwnerAfter , contract1 , 'candidateOwner should be false');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 2
		var contract2 = accounts[16];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 1 , 'candidateCount should be 0');

		// var candidateOwnerBefore = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwnerBefore , 0 , 'candidateOwner should be false');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 1);
		assert.equal(candidate , contract2 , 'candidate should be set');

		// var candidateIndexAfter = await governanceInstance.candidateIndex.call(counter , contract2);
		// assert.equal(candidateIndexAfter.toNumber() , 1 , 'candidateIndex should match');

		// var candidateOwnerAfter = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwnerAfter , contract2 , 'candidateOwner should be false');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeightAfter.toNumber() , 1 , 'candidateWeight should be 0');
	});

	it('governance : submit : should throw error if candidate address added before submission period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 6 , {from: owner});
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 0 , 'candidateCount should be 0');
	});	

	it('governance : submit : should allow if candidate address added middle of submission period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');
	});	

	it('governance : submit : should throw error if candidate address added after submission period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 8 , {from: owner});
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 0 , 'candidateCount should be 0');
	});

	it('governance : submit : should not allow double submission of candidate' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		await governanceInstance.setBlockNumber(166666 , {from: owner});

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		var contract1 = accounts[15];
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 1 , 'candidateCount should be 1');

		var contract2 = accounts[16];
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract2 = accounts[16];
		assert_throw(governanceInstance.submit(contract2 , {from: contract2}));

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract1 = accounts[15];
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract3 = accounts[17];
		await governanceInstance.submit(contract3 , {from: contract3});

		var candidateCountAfter = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCountAfter.toNumber() , 3 , 'candidateCount should be 3');
	});



	/* CHOOSE CANDIDATE */	
	it('governance : choose : should allow voting the candidate during period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});
	});

	it('governance : choose : should allow voting the candidate during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore , 1 , 'candidateWeight should be 0');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be 0');

		var voterCandidateBefore = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidateBefore , 0 , 'voterCandidate should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		// var voterCountAfter = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCountAfter.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndexAfter = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndexAfter.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		var voterCandidateAfter = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidateAfter , contract1 , 'voterCandidate should match');
	});

	it('governance : choose : should allow voting the candidate during period with two accounts and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore , 1 , 'candidateWeight should be 0');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		// var voterCountAfter = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCountAfter.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndexAfter = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndexAfter.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , balanceAccount1.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');


		var candidateWeightBefore = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightBefore , balanceAccount1.toNumber() + 1, 'candidateWeight should be balanceAccount1');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersBefore , balanceAccount1.toNumber() , 'candidateVoters should be balanceAccount1');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be balanceAccount1');

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account2});

		// var voterCountAfter = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCountAfter.toNumber() , 2 , 'voterCount should be 2');

		// var voterIndexAfter = await governanceInstance.voterIndex.call(counter , account2);
		// assert.equal(voterIndexAfter.toNumber() , 1 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 1);
		// assert.equal(voter , account2 , 'voter should be set');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeightAfter.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 20E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

	});

	it('governance : choose : should allow voting the candidate and update the finalist' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
		var account4 = accounts[8];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , 0 , 'finalistWeight should be 0');	

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be 10E18');	
	});

	it('governance : choose : should allow voting the multiple candidates and update the finalist' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
		var account4 = accounts[8];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , 0 , 'finalistWeight should be 0');	

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be 10E18');	


		// SECOND VOTING

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account2});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistWeight should be 10E18');	


		// THIRD VOTING

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account3 , 1200E18 , {from: owner});
		var balanceAccount3 = await tokenInstance.balanceOf.call(account3);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract2 , {from: account3});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract2 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount3.toNumber() , 'finalistWeight should be 10E18');	


		// FOURTH VOTING

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract2 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount3.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account4 , 1100E18 , {from: owner});
		var balanceAccount4 = await tokenInstance.balanceOf.call(account4);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account4});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount4.toNumber() , 'finalistWeight should be 10E18');	
	});

	it('governance : choose : should not allow if candidate address is invalid' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should throw error if candidate address added before choose period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});	

	it('governance : choose : should allow if candidate address added middle of choose period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');
	});	

	it('governance : choose : should throw error if candidate address added after choose period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 9 , {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should not allow voting the multiple candidates from single account' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		var account2 = accounts[6];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be 0');

		assert_throw(tokenInstance.transfer(account1 , 100E18 , {from: owner}));
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract2 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');
	});

	it('governance : choose : should throw error if voters does not have enough tokens' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[10];
		var contract1 = accounts[15];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should not allow double voting the candidate during period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var contract1 = accounts[15];

		var account2 = accounts[6];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		// FIRST VOTE 

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');

		// SECOND VOTE 

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract1 , 'finalist should be 0');

		await tokenInstance.transfer(account2 , 150E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract2 , 'finalist should be 0');

		// THIRD VOTE 
		
		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract2 , 'finalist should be 0');

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract2 , 'finalist should be 0');
	});

	/* DECIDE CANDIDATE */
	it('governance : decide : should allow decide the finalist during decide period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});
		
		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

	});

	it('governance : decide : should allow decide the finalist during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
		

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		// var supporterCountAfter = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCountAfter.toNumber() , 1 , 'supporterCount should be 2');

		// var supporterIndexAfter = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndexAfter.toNumber() , 0 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');


		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// CHOOSE SECOND

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		// var supporterCountAfter = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCountAfter.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndexAfter = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndexAfter.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account1 , 'supporter should be set');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
	});

	it('governance : decide : should allow support the finalist and verify quorum reached' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');

		// CHOOSE SECOND
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if finalist address supported before decide period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport , 0 , 'finalistSupport should match');
	});

	it('governance : decide : should allow if finalist address supported middle decide period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if finalist address supported after decide period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport , 0 , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if support does not have enough tokens' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		
		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.decide({from: account3}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');

	});

	it('governance : decide : should not allow double support the candidate during period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');	


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');	


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');	

	});

	/* CLOSE CANDIDATE */

	it('governance : close : should allow close finalist during close period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		
	});

	it('governance : close : should allow close finalist during close period and set params' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract2 , 'finalist should match');

		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore , balanceAccount2.toNumber() , 'finalistWeight should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore , balanceAccount2.toNumber() , 'finalistSupport should match');

		// var decided = await governanceInstance.decided.call(counter);
		// assert.equal(decided , 0 , 'decided should match');

		// var decidedWeight = await governanceInstance.decidedWeight.call(counter);
		// assert.equal(decidedWeight , 0 , 'decidedWeight should match');

		// var decidedSupport = await governanceInstance.decidedSupport.call(counter);
		// assert.equal(decidedSupport , 0 , 'decidedSupport should match');

		var closed = await governanceInstance.closed.call(counter);
		assert.equal(closed , false , 'closed should be 0');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract2 , 'finalist should match');

		var finalistWeightAfter = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightAfter , finalistWeightBefore.toNumber() , 'finalistWeight should match');

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportAfter , finalistSupportBefore.toNumber() , 'finalistSupport should match');

		// var decided = await governanceInstance.decided.call(counter);
		// assert.equal(decided , contract2 , 'decided should match');

		// var decidedWeight = await governanceInstance.decidedWeight.call(counter);
		// assert.equal(decidedWeight , finalistWeightBefore.toNumber() , 'decidedWeight should match');

		// var decidedSupport = await governanceInstance.decidedSupport.call(counter);
		// assert.equal(decidedSupport , finalistSupportBefore.toNumber() , 'decidedSupport should match');	

		var closed = await governanceInstance.closed.call(counter);
		assert.equal(closed , true , 'closed should be 0');
	});

	it('governance : close : should throw error if close called before close period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.close({from: owner}));

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');		
	});

	it('governance : close : should allow if close called middle close period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		
	});

	it('governance : close : should throw error if close called after close period' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 7, {from: owner});
		assert_throw(governanceInstance.close({from: owner}));

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');		
	});

	it('governance : close : should allow close finalist with quorum reached' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	
	});

	it('governance : close : should allow close finalist without quorum reached' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	
	});

	it('governance : close : should allow close finalist and reset the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var finalistBefore = await governanceInstance.finalist.call(counter);
		assert.equal(finalistBefore , contract2 , 'finalist should match');

		var finalistWeightBefore = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightBefore , balanceAccount2.toNumber() , 'finalistWeight should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportBefore , balanceAccount2.toNumber() , 'finalistSupport should match');

		// var decided = await governanceInstance.decided.call(counter);
		// assert.equal(decided , 0 , 'decided should match');

		// var decidedWeight = await governanceInstance.decidedWeight.call(counter);
		// assert.equal(decidedWeight , 0 , 'decidedWeight should match');

		// var decidedSupport = await governanceInstance.decidedSupport.call(counter);
		// assert.equal(decidedSupport , 0 , 'decidedSupport should match');

		var closed = await governanceInstance.closed.call(counter);
		assert.equal(closed , false , 'closed should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	

		var finalistAfter = await governanceInstance.finalist.call(counter);
		assert.equal(finalistAfter , contract2 , 'finalist should match');

		var finalistWeightAfter = await governanceInstance.finalistWeight.call(counter);
		assert.equal(finalistWeightAfter , finalistWeightBefore.toNumber() , 'finalistWeight should match');

		var finalistSupportAfter = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupportAfter , finalistSupportBefore.toNumber() , 'finalistSupport should match');
		
		// var decided = await governanceInstance.decided.call(counter);
		// assert.equal(decided , contract2 , 'decided should match');

		// var decidedWeight = await governanceInstance.decidedWeight.call(counter);
		// assert.equal(decidedWeight , finalistWeightBefore.toNumber() , 'decidedWeight should match');

		// var decidedSupport = await governanceInstance.decidedSupport.call(counter);
		// assert.equal(decidedSupport , finalistSupportBefore.toNumber() , 'decidedSupport should match');	

		var closed = await governanceInstance.closed.call(counter);
		assert.equal(closed , true , 'closed should match');
	});

	it('governance : close : should rotate the cycle properly' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		// Cycle 1 - 1 DM
		
		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 2 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 3 , 'cycleCounter should match');

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount , 0 , 'candidate count should match');

		// Cycle 2 - 0 GOV

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 3 , 'cycleCounter should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , contract1 , 'candidateOwner count should match');

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 2 , 'candidateCount count should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount count should match');
		
		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');

		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');	

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 4 , 'cycleCounter should match');

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount , 0 , 'candidate count should match');

		// Cycle 3 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 4 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 5 , 'cycleCounter should match');	

		// Cycle 4 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 5 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 6 , 'cycleCounter should match');

		// Cycle 5 - 0 GOV

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 6 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 7 , 'cycleCounter should match');

		// Cycle 6 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 7 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 8 , 'cycleCounter should match');	

		// Cycle 7 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 8 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 9 , 'cycleCounter should match');	

		// Cycle 8 - 0 GOV

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 9 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});
		var counter = await governanceInstance.cycleCounter.call();

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 10 , 'cycleCounter should match');
	});

	it('governance : cancel : should allow cancellation the candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');
	});

	it('governance : cancel : should allow cancellation the two candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 2
		var contract2 = accounts[16];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 1);
		assert.equal(candidate , contract2 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract2);
		// assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwner , contract2 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 3
		var contract3 = accounts[17];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract3 , {from: contract3});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 3 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 2);
		assert.equal(candidate , contract3 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// assert.equal(candidateIndex.toNumber() , 2 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract3);
		// assert.equal(candidateOwner , contract3 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract3);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');
		
		// // cancel contract 1
		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract1 , {from: contract1});
		
		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 0');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract3 , 'candidate should be set');

		// var candidate = await governanceInstance.candidates.call(counter , 1);
		// assert.equal(candidate , contract2 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract2);
		// // assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// // cancel contract 2
		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract2 , {from: contract2});
		
		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 0');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract3 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');
	});

	it('governance : decline : should allow decline the candidate during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , 1 , 'candidateWeight should be 0');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be 0');

		var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidate , 0 , 'voterCandidate should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidate , contract1 , 'voterCandidate should match');

		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account1});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be match');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be match');

		var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidate , contract1 , 'voterCandidate should match');
	});

	it('governance : decline : should allow decline the candidate during period with two accounts and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , 1 , 'candidateWeight should be 0');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');


		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , balanceAccount1.toNumber() + 1, 'candidateWeight should be balanceAccount1');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , balanceAccount1.toNumber() , 'candidateVoters should be balanceAccount1');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be balanceAccount1');

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account2});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 2 , 'voterCount should be 2');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// assert.equal(voterIndex.toNumber() , 1 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 1);
		// assert.equal(voter , account2 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 20E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// choose 

		await tokenInstance.transfer(account3 , 10E18 , {from: owner});
		var balanceAccount3 = await tokenInstance.balanceOf.call(account3);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account3});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 3 , 'voterCount should be 2');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account3);
		// assert.equal(voterIndex.toNumber() , 2 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 2);
		// assert.equal(voter , account3 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() + 1, 'candidateWeight should be 20E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		assert.equal(candidateVoters.toNumber() , balanceAccount3.toNumber() , 'candidateVoters should be 10E18');

		// // decline 
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account3});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 2 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 1 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account1 , 'voter should be set');

		// // var voter = await governanceInstance.voters.call(counter , 1);
		// // assert.equal(voter , account2 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be 10E18');

		// // decline
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account2 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount2.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

	});

	it('governance : dither : should allow dither the finalist during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account3 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account3});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);
		var balanceAccount3 = await tokenInstance.balanceOf(account3);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
		

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 1 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');


		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// CHOOSE SECOND

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account1 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');


		// CHOOSE THIRD

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account3});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 3 , 'supporterCount should be 3');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 2 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account1 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 2);
		// assert.equal(supporter , account3 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// dither

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.dither({from: account1});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account3 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');


		// dither

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.dither({from: account2});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 1 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account3 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
	});

	it('governance : submitSafe : should allow submit safe the candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submitSafe(contract1 , {from: contract1});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.submitSafe(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract1 , 'candidate should be set');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.submitSafe(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract1 , 'candidate should be set');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

	});

	it('governance : submitSafe : should allow cancellation the two candidate and update the variables' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var contract1 = accounts[15];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submitSafe(contract1 , {from: contract1});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 1 again 

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.submitSafe(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 1');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract1 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 2
		var contract2 = accounts[16];

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 0');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeight.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submitSafe(contract2 , {from: contract2});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 1);
		assert.equal(candidate , contract2 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract2);
		// assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// assert.equal(candidateOwner , contract2 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// // safe add candidate 1

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.submitSafe(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 1');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract2 , 'candidate should be set');

		// var candidate = await governanceInstance.candidates.call(counter , 1);
		// assert.equal(candidate , contract1 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract2);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// // assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// // assert.equal(candidateOwner , contract2 , 'candidateOwner should be false');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// add candidate 3
		var contract3 = accounts[17];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract3 , {from: contract3});

		var candidateCount = await governanceInstance.candidateCount.call(counter);
		assert.equal(candidateCount.toNumber() , 3 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(counter , 2);
		assert.equal(candidate , contract3 , 'candidate should be set');

		// var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// assert.equal(candidateIndex.toNumber() , 2 , 'candidateIndex should match');

		// var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract3);
		// assert.equal(candidateOwner , contract3 , 'candidateOwner should be false');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract3);
		assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');
		
		// // cancel contract 1
		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract1 , {from: contract1});
		
		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 0');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract2 , 'candidate should be set');

		// var candidate = await governanceInstance.candidates.call(counter , 1);
		// assert.equal(candidate , contract3 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract2);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// // assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// // cancel contract 2
		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.cancel(contract2 , {from: contract2});
		
		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 1 , 'candidateCount should be 0');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract3 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract2);
		// // assert.equal(candidateOwner , 0 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract2);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

		// // safe add candidate 1

		// await governanceInstance.setBlockNumber(166666 , {from: owner});
		// await governanceInstance.submitSafe(contract1 , {from: contract1});

		// var candidateCount = await governanceInstance.candidateCount.call(counter);
		// assert.equal(candidateCount.toNumber() , 2 , 'candidateCount should be 1');

		// var candidate = await governanceInstance.candidates.call(counter , 0);
		// assert.equal(candidate , contract3 , 'candidate should be set');

		// var candidate = await governanceInstance.candidates.call(counter , 1);
		// assert.equal(candidate , contract1 , 'candidate should be set');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract3);
		// // assert.equal(candidateIndex.toNumber() , 0 , 'candidateIndex should match');

		// // var candidateIndex = await governanceInstance.candidateIndex.call(counter , contract1);
		// // assert.equal(candidateIndex.toNumber() , 1 , 'candidateIndex should match');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract3);
		// // assert.equal(candidateOwner , contract3 , 'candidateOwner should be false');

		// // var candidateOwner = await governanceInstance.candidateOwner.call(counter , contract1);
		// // assert.equal(candidateOwner , contract1 , 'candidateOwner should be false');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be 0');

	});


	it('governance : chooseSafe : should allow choose safe the candidate during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , 1 , 'candidateWeight should be 0');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be 0');

		var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidate , 0 , 'voterCandidate should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account1);
			
		// choose safe for first time	
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.chooseSafe(contract1 , {from: account1});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		assert.equal(voterCandidate , contract1 , 'voterCandidate should match');

		// // choose safe again 
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account1 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		// var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		// assert.equal(voterCandidate , contract1 , 'voterCandidate should match');

		// // decline
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 0 , 'voterCount should be 1');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be match');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be match');

		// var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		// assert.equal(voterCandidate , 0 , 'voterCandidate should match');

		// // choose safe again
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account1 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		// var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		// assert.equal(voterCandidate , contract1 , 'voterCandidate should match');

		// // decline
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 0 , 'voterCount should be 1');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , 1 , 'candidateWeight should be match');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be match');

		// var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		// assert.equal(voterCandidate , 0 , 'voterCandidate should match');

		// // choose again
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.choose(contract1 , {from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account1 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balance.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

		// var voterCandidate = await governanceInstance.voterCandidate.call(counter , account1);
		// assert.equal(voterCandidate , contract1 , 'voterCandidate should match');

	});

	it('governance : chooseSafe : should allow choose safe the candidate during period with two accounts and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , 1 , 'candidateWeight should be 0');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await tokenInstance.transfer(account3 , 10E18 , {from: owner});
		var balanceAccount3 = await tokenInstance.balanceOf.call(account3);

		
		// choose safe 
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.chooseSafe(contract1 , {from: account1});

		// var voterCount = await governanceInstance.voterCount.call(counter);
		// assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// var voter = await governanceInstance.voters.call(counter , 0);
		// assert.equal(voter , account1 , 'voter should be set');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + 1, 'candidateWeight should be 10E18');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		assert.equal(candidateWeight , balanceAccount1.toNumber() + 1, 'candidateWeight should be balanceAccount1');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		assert.equal(candidateVoters , balanceAccount1.toNumber() , 'candidateVoters should be balanceAccount1');

		var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		assert.equal(candidateVoters , 0 , 'candidateVoters should be balanceAccount1');

		
		// // choose safe again
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account2});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 2 , 'voterCount should be 2');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 1 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 1);
		// // assert.equal(voter , account2 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 20E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// // choose safe

		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account3});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 3 , 'voterCount should be 2');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account3);
		// // assert.equal(voterIndex.toNumber() , 2 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 2);
		// // assert.equal(voter , account3 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() + 1, 'candidateWeight should be 20E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		// assert.equal(candidateVoters.toNumber() , balanceAccount3.toNumber() , 'candidateVoters should be 10E18');


		// // choose safe 

		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 3 , 'voterCount should be 2');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account3);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 2 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account3 , 'voter should be set');

		// // var voter = await governanceInstance.voters.call(counter , 2);
		// // assert.equal(voter , account1 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() + 1, 'candidateWeight should be 20E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		// assert.equal(candidateVoters.toNumber() , balanceAccount3.toNumber() , 'candidateVoters should be 10E18');


		// // decline 
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account3});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 2 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 1 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account1 , 'voter should be set');

		// // var voter = await governanceInstance.voters.call(counter , 1);
		// // assert.equal(voter , account2 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be 10E18');

		// // decline
		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.decline({from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 1 , 'voterCount should be 1');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account2 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount2.toNumber() + 1, 'candidateWeight should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// // choose safe 

		// await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		// await governanceInstance.chooseSafe(contract1 , {from: account1});

		// // var voterCount = await governanceInstance.voterCount.call(counter);
		// // assert.equal(voterCount.toNumber() , 2 , 'voterCount should be 2');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account2);
		// // assert.equal(voterIndex.toNumber() , 0 , 'voterIndex should match');

		// // var voterIndex = await governanceInstance.voterIndex.call(counter , account1);
		// // assert.equal(voterIndex.toNumber() , 1 , 'voterIndex should match');

		// // var voter = await governanceInstance.voters.call(counter , 0);
		// // assert.equal(voter , account2 , 'voter should be set');

		// // var voter = await governanceInstance.voters.call(counter , 1);
		// // assert.equal(voter , account1 , 'voter should be set');

		// var candidateWeight = await governanceInstance.candidateWeight.call(counter , contract1);
		// assert.equal(candidateWeight.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + 1, 'candidateWeight should be 20E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account1);
		// assert.equal(candidateVoters.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account2);
		// assert.equal(candidateVoters.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

		// var candidateVoters = await governanceInstance.candidateVoters.call(counter , contract1 , account3);
		// assert.equal(candidateVoters.toNumber() , 0 , 'candidateVoters should be 10E18');
	});


	it('governance : decideSafe : should allow decide safe the finalist during period and verify votes, weight' , async () => {
		var counter = await governanceInstance.cycleCounter.call();

		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account3 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account3});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);
		var balanceAccount3 = await tokenInstance.balanceOf(account3);

		var finalist = await governanceInstance.finalist.call(counter);
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
		

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account2});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 1 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// decide again 
		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account2});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 1 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account2 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// decide second

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account1});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account1 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// decide again

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account2});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account1 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');


		// CHOOSE THIRD

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account3});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 3 , 'supporterCount should be 3');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 2 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account1 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 2);
		// assert.equal(supporter , account3 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// dither

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.dither({from: account1});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account3 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// safe choose

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account1});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 3 , 'supporterCount should be 3');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 2 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account3 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 2);
		// assert.equal(supporter , account1 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// safe choose

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decideSafe({from: account3});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 3 , 'supporterCount should be 3');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account3);
		// assert.equal(supporterIndex.toNumber() , 2 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account1 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 2);
		// assert.equal(supporter , account3 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , balanceAccount3.toNumber() , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount3.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// dither

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.dither({from: account3});

		// var supporterCount = await governanceInstance.supporterCount.call(counter);
		// assert.equal(supporterCount.toNumber() , 2 , 'supporterCount should be 2');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account1);
		// assert.equal(supporterIndex.toNumber() , 0 , 'supporterIndex should match');

		// var supporterIndex = await governanceInstance.supporterIndex.call(counter , account2);
		// assert.equal(supporterIndex.toNumber() , 1 , 'supporterIndex should match');

		// var supporter = await governanceInstance.supporters.call(counter , 0);
		// assert.equal(supporter , account1 , 'supporter should be set');

		// var supporter = await governanceInstance.supporters.call(counter , 1);
		// assert.equal(supporter , account2 , 'supporter should be set');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account2);
		assert.equal(finalistSupporters.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account1);
		assert.equal(finalistSupporters.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupporters = await governanceInstance.finalistSupporters.call(counter , account3);
		assert.equal(finalistSupporters.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupport = await governanceInstance.finalistSupport.call(counter);
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call(counter);
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
	});
});