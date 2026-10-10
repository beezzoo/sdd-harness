# billing Specification

## Purpose
Charges customers for orders and keeps account balances consistent with recorded transactions.

## Requirements
### Requirement: Reject charge on insufficient balance
<!-- enforced: src/billing/charge.ts:charge -->
<!-- entities: Account, Order -->
<!-- test: tests/billing.test.ts:rejects insufficient -->
The system SHALL reject a charge whose amount exceeds the account balance.

#### Scenario: Balance too low
- **WHEN** a charge of 100 is requested on an account with balance 50
- **THEN** the charge is rejected with error INSUFFICIENT_FUNDS
- **AND** the balance stays 50

### Requirement: Balance equals transaction sum (invariant)
<!-- enforced: src/billing/ledger.ts:apply -->
<!-- entities: Account -->
The system SHALL ensure an account balance always equals the sum of its recorded transactions.

#### Scenario: Invariant holds after any mutation
- **WHEN** any operation that changes an Account completes
- **THEN** the balance equals the sum of its transactions

<!-- uncertainty: refunds path not confirmed -->
<!-- deferred: src/billing/legacy.ts -->
