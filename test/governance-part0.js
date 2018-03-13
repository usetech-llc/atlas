/*

INITIALIZATION
	initialize correct to correct cycle - done in part1

SUBMIT AMMENDMENT
	throw error if ammendment address added before submission period - done in part1
	throw error if ammendment address added after submission period - done in part1
	update ammendments if address added during submission period - done in part1

ELECT AMMENDMENT
	throw error if election submitted before election period - done in part1
	throw error if election submitted after election period - done in part1
	add correct voting weight to ammenments if election submitted during election period for address with 0 weight - not done. voting can't be done for 0 weight
	add correct voting weight to ammenments if election submitted for address with non-zero weight - done in part1
	remove weight if token ownership is transferred - done in part2
	remove weight if vote is rescinded - done in part1
	move weight if vote is changed - done in part2
	update weight to current balance for same ammendment - done in part2
	update weight if vote is rescinded then recast for same ammendment - done in part2
	move weight if vote is rescinded then recast for different ammendment - done in part2

DETERMINE FINALIST
	throw error if election closed before election period is over - done in part1
	set finalist to ammendment address with most votes - done in part4
	set finalist to one of the winning addresses in case of a tie (should be random) - done in part1
	reset ammendments - done in part2

SUPPORT FINALIST
	throw error if support submitted before decision period - done in part1
	throw error if support submitted after decision period - done in part1
	add correct voting weight to finalist - done in part1
	remove weight if token ownership is transferred - done in part2
	remove weight if vote is rescinded - done in part2
  	update weight to current balance if voting again - done in part2
	update weight if vote is rescinded then recast - done in part2

CLOSE CYCLE
	throw error if cycle closed before decision period is over - done in part1
	return correct support level based on (support / circulating tokens = ) - done in part3
	reset global variables (finalist, finalist_support) - done in part1
	increment cycle_counter - done in part1
	leave Relay variables unchanged if quorum not reached - done in part3
	change Relay's DM variable to finalist address if this is DM cycle and quorum is reached - done in part3
	change Relay's G variable to finalist address if this is G cycle and quorum is reached - done in part3

*/