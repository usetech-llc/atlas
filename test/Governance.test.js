/*

INITIALIZATION
	initialize correct to correct cycle

SUBMIT AMMENDMENT
	throw error if ammendment address added before submission period
	throw error if ammendment address added after submission period
	update ammendments if address added during submission period

ELECT AMMENDMENT
	throw error if election submitted before election period
	throw error if election submitted after election period
	add correct voting weight to ammenments if election submitted during election period for address with 0 weight
	add correct voting weight to ammenments if election submitted for address with non-zero weight
	remove weight if token ownership is transferred
	remove weight if vote is rescinded
	move weight if vote is changed
	update weight to current balance for same ammendment
	update weight if vote is rescinded then recast for same ammendment
	move weight if vote is rescinded then recast for different ammendment

DETERMINE FINALIST
	throw error if election closed before election period is over
	set finalist to ammendment address with most votes
	set finalist to one of the winning addresses in case of a tie (should be random)
	reset ammendments

SUPPORT FINALIST
	throw error if support submitted before decision period
	throw error if support submitted after decision period
	add correct voting weight to finalist
	remove weight if token ownership is transferred
	remove weight if vote is rescinded
  update weight to current balance if voting again
	update weight if vote is rescinded then recast

CLOSE CYCLE
	throw error if cycle closed before decision period is over
	return correct support level based on (support / circulating tokens = )
	reset global variables (finalist, finalist_support)
	increment cycle_counter
	leave Relay variables unchanged if quorum not reached
	change Relay's DM variable to finalist address if this is DM cycle and quorum is reached
	change Relay's G variable to finalist address if this is G cycle and quorum is reached

*/
