# Class Diagram (V1)

Status: accepted.

The domain classes of the back-end modules ([standards §1.1](../04_RULES/ENGINEERING_STANDARDS.md#11-modular-monolith)). Attributes come from the [ERD](ERD.md), which holds every column, key, and constraint. Operations are the actions in [WORKFLOWS.md](../01_PROBLEM/WORKFLOWS.md). Their final method names are chosen in P2.

Link tables (`USER_ROLE`, the document link tables), form fields, emails, and the supporting tables are left out for readability.

## Domain classes

```mermaid
classDiagram
  direction LR

  namespace Accounts {
    class UserAccount {
      +uuid id
      +text email
      +Language preferred_language
      +AccountStatus status
      +Role[] roles
      +completeSetup(token, password)
    }
    class AccountSetupToken {
      +text token_hash
      +timestamp expires_at
      +timestamp used_at
      +isUsable() bool
    }
  }

  namespace SupplierSignUp {
    class SupplierApplication {
      +text legal_name
      +text registration_number
      +text contact_email
      +Language preferred_language
      +submit()
    }
    class SignupReview {
      +Decision decision
      +text reason
      +timestamp raised_to_admin_at
      +timestamp admin_accepted_at
      +decide(decision, reason)
      +acceptByAdmin()
    }
    class Supplier {
      +text legal_name
      +text registration_number
      +text technical_information
      +SupplierStatus status
      +suspend()
      +reactivate()
    }
  }

  namespace Tenders {
    class Tender {
      +uuid id
      +TenderStatus status
      +int revision
      +decimal estimated_balance
      +char currency_code
      +timestamp application_deadline
      +timestamp technical_deadline
      +timestamp financial_deadline
      +accept(scoring)
      +publish(deadlines)
      +closeOrCancelAtApplicationDeadline()
      +startEvaluation()
      +copy() Tender
    }
    class TenderTranslation {
      +Language language
      +text title
      +text description
    }
    class TenderScoring {
      +int technical_weight
      +int financial_weight
      +int minimum_technical_score
    }
  }

  namespace Committees {
    class TenderCommittee {
      +CommitteeType type
      +timestamp raised_at
      +nominate(name, email)
    }
    class CommitteeAssignment {
      +text nominee_name
      +text nominee_email
      +AssignmentStatus status
      +approve()
      +reject()
    }
  }

  namespace Bids {
    class Bid {
      +text bidder_code
      +timestamp submitted_at
    }
    class BidPart {
      +PartType part_type
      +timestamp last_submitted_at
      +replace(answers, files)
      +isLocked(serverTime) bool
    }
  }

  namespace Evaluations {
    class LegalEvaluation {
      +LegalOutcome outcome
      +text reason
    }
    class TechnicalEvaluation {
      +int technical_score
      +bool meets_minimum
      +text comments
    }
    class FinancialEvaluation {
      +int financial_score
      +decimal confirmed_total_price
      +text comments
    }
  }

  namespace Award {
    class BidRanking {
      +decimal combined_score
      +bool above_estimated_balance
    }
    class TenderAward {
      +AwardSelection selection
      +timestamp awarded_at
      +breakTie(bid)
    }
  }

  namespace Shared {
    class Document {
      +text storage_key
      +text original_name
      +text mime_type
      +text language
    }
  }

  UserAccount "1" --> "0..*" AccountSetupToken
  SupplierApplication "1" --> "0..1" SignupReview
  SupplierApplication "1" --> "0..1" Supplier : becomes
  UserAccount "1" --> "0..1" Supplier : signs in as
  Tender "1" *-- "1..2" TenderTranslation
  Tender "1" *-- "0..1" TenderScoring
  Tender "0..1" --> "0..1" Tender : copied into
  Tender "1" *-- "0..3" TenderCommittee
  TenderCommittee "1" *-- "0..*" CommitteeAssignment
  UserAccount "0..1" --> "0..*" CommitteeAssignment : serves via
  Tender "1" --> "0..*" Bid
  Supplier "1" --> "0..*" Bid
  Bid "1" *-- "3" BidPart
  Bid "1" --> "0..1" LegalEvaluation
  Bid "1" --> "0..1" TechnicalEvaluation
  Bid "1" --> "0..1" FinancialEvaluation
  CommitteeAssignment "1" --> "0..*" LegalEvaluation : records
  CommitteeAssignment "1" --> "0..*" TechnicalEvaluation : records
  CommitteeAssignment "1" --> "0..*" FinancialEvaluation : records
  Bid "1" --> "0..1" BidRanking
  Tender "1" --> "0..1" TenderAward
  TenderAward "0..1" --> "1" Bid : selects
  SupplierApplication "0..1" --> "0..*" Document
  Supplier "0..1" --> "0..*" Document
  Tender "0..1" --> "0..*" Document : Terms of Reference
  BidPart "0..1" --> "0..*" Document
  Document "0..1" --> "0..*" Document : translated as
```

Each document has exactly one owner: an application, a supplier, a tender, or a bid part ([ERD](ERD.md#document-ownership)). `UserAccount.roles` is derived from `USER_ROLE`.

## Enumerations

```mermaid
classDiagram
  class TenderStatus {
    <<enumeration>>
    draft
    accepted
    published
    closed
    under_evaluation
    awarded
    cancelled
  }
  class Role {
    <<enumeration>>
    supplier
    employee
    procurement_officer
    admin
    legal_committee
  }
  class CommitteeType {
    <<enumeration>>
    legal_committee
    technical_committee
    financial_committee
  }
  class PartType {
    <<enumeration>>
    legal_information
    technical_offer
    financial_offer
  }
  class AccountStatus {
    <<enumeration>>
    pending_setup
    active
    disabled
  }
  class SupplierStatus {
    <<enumeration>>
    active
    suspended
  }
  class AssignmentStatus {
    <<enumeration>>
    nominated
    approved
    rejected
  }
  class AwardSelection {
    <<enumeration>>
    top_rank
    tie_break
  }
```

`Language` is `en | ar`, `Decision` is `accepted | rejected`, and `LegalOutcome` is `pass | fail`.

## Access service and response views

Every read of a tender, bid, or evaluation goes through one access service, which picks the response view for the caller's audience ([ADR 0004](ADR/0004_TECHNOLOGY_STACK.md), [standards §2.7](../04_RULES/ENGINEERING_STANDARDS.md#27-dtos)). Each view is a separate class, never one class trimmed by conditions.

```mermaid
classDiagram
  direction LR
  class AccessService {
    <<service>>
    +viewFor(user, resource) View
  }
  class PublicTender {
    <<view>>
    details and deadlines
  }
  class EmployeeTender {
    <<view>>
    own tender at any status, editable while draft
  }
  class ManagedTender {
    <<view>>
    full tender for the officer
  }
  class SupplierBid {
    <<view>>
    the supplier's own bid
  }
  class LegalBidView {
    <<view>>
    legal information, supplier identity
  }
  class TechnicalBidView {
    <<view>>
    technical offer, bidder code
  }
  class FinancialBidView {
    <<view>>
    financial offer, bidder code
  }
  class BidRankingView {
    <<view>>
    supplier names, scores, ranking
  }
  AccessService ..> PublicTender
  AccessService ..> EmployeeTender
  AccessService ..> ManagedTender
  AccessService ..> SupplierBid
  AccessService ..> LegalBidView
  AccessService ..> TechnicalBidView
  AccessService ..> FinancialBidView
  AccessService ..> BidRankingView
```

`TechnicalBidView` and `FinancialBidView` never contain the bid ID, the supplier's identity, original file names, or the other offer. `BidRankingView` never contains bid contents.
