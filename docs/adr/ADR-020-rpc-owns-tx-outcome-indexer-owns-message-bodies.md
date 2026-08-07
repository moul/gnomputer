# ADR-020: RPC owns a transaction's outcome; the indexer owns its message bodies

## Context

The Block Explorer's per-transaction list was built on RPC `block_results`
(ADR-016). That source is available on every network, needs no indexer, and
is the node's own execution result — but it carries **no message bodies at
all**. A transaction renders as its index, a success flag and a gas pair,
and nothing else. Topaz block 467231 is a 15 GNOT transfer between two
accounts; `block_results` can only say that it used 1,238,416 gas.

The tx-indexer does have the bodies: signer, called function and arguments,
amounts, memo, deposit, package path, and a human-readable failure reason.
Confirmed live against Topaz for all four message types the chain uses
(`BankMsgSend`, `MsgCall`, `MsgAddPackage`, `MsgRun`).

So the obvious move is to merge the two. The question this record answers is
what to do when they disagree.

## They do disagree, and not rarely enough to ignore

Checked against three transactions the indexer reports as failed:

| block | indexer | RPC `block_results` | agree? |
|---|---|---|---|
| 408790 | `out of gas error` | `/std.OutOfGasError` | yes |
| 364856 | `storage deposit processing…` | `/abci.StringError` | yes |
| **427346** | `success: false`, `unauthorized error`, `gas_used` 1,985,154, `gas_wanted` **0** | `Error: null`, `GasUsed` 528,532,282, every one of its 8 messages `success:true` | **no** |

427346 is the same transaction in both sources — verified by hash:
`sha256` of the raw tx in the block is
`SjBJPoSdHTZcXFaZOQKEKZjXLS14HoclXHY6vaBA+jg=`, which is exactly the `hash`
the indexer returns for it. So this is not two different transactions being
compared; it is one transaction with two contradictory records.

A `gas_wanted` of 0 is not a possible value for a transaction that
executed, which is the strongest hint that the indexer's numeric and
outcome fields for this row are wrong rather than merely different.

## Decision

Split ownership by field, rather than preferring one source wholesale:

- **RPC `block_results` owns the outcome and gas.** It is the node's own
  ABCI result for the block, and it is what the chain will tell anyone
  else who asks. The success/failed badge and the gas pair keep coming
  from it, unchanged.
- **The indexer owns the message bodies**, plus memo, hash and fee. The
  hash match above is what makes this safe: the row really is the same
  transaction, so its bodies describe the right thing even where its
  outcome field does not.
- **Merging is by `txIndex`**, which the hash check validates for the one
  case where the sources conflict.
- **The indexer's failure reason is only rendered when RPC also reports a
  failure.** Otherwise Gnomputer would print "unauthorized error" across a
  transaction the chain says succeeded — worse than showing no reason at
  all, because it looks authoritative.
- **When they conflict, say so.** The row shows the chain's verdict and one
  line noting that the indexer disagrees. Silently dropping the conflict
  would make a contradiction between two services look like settled fact,
  which is the failure mode ADR-004's provenance rules exist to prevent.

## Consequences

- Networks with no indexer (gnodev) lose the message detail and keep
  exactly the current behaviour. The query is skipped rather than failed,
  and no error is surfaced: less detail is a downgrade, not a fault.
- A transaction that genuinely failed still shows its reason, which was
  previously unavailable anywhere in the app — the list said only
  "failed".
- If the indexer's outcome field is fixed upstream, the disagreement
  branch simply stops rendering; nothing needs removing.
- This does not attempt to explain *why* 427346 disagrees. A rejected
  CheckTx recorded against a height is one plausible story, but nothing
  here depends on which story is right, and guessing in a code comment
  would age badly.
