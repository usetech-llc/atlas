/*

ALLOCATE ACX
	throw error if called by unauthorized address
	update ACX allocations for proper address and ACX_balance of IP
		if called by Governance account
		if called by DM account
	(MINT ACX tests)

ALLOCATE ETH
	(same as ACX)

CLAIM ACX
	don't send funds if called by address with 0 allocation
	send funds and update ACX allocations to 0 if called by address with non-zero allocation
	don't send funds if called again after allocations are claimed 

CLAIM ETH
	(same as ACX)

MINT ACX
	update ACX_balance & ACX_minted for all cases
		a. last update and now are in deterministic period
		b. last update is in deterministic period, now is dynamic period
			i) inflation = 0
			ii) inflation = 1
			iii) inflation = 0.5
		c. last update and now are in dynamic period
			i) inflation = 0
			ii) inflation = 1
			iii) inflation = 0.5
UNLOCK ETH
	update ETH_balance & ETH_unlocked for all cases 
		a. now is in unlocking period
		b. last_update is in unlocking period, now is past it


INFLATION RATE
	update inflation rate and account's inflation switch 
		for -> against
		against -> for

*/