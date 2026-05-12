Feature: Lego Build Status
  As a family member managing a Lego collection
  I want to tag each set with its current build state
  So that I can track which sets are boxed, built on display, or disassembled

  Background:
    Given I am logged in as an editor
    And I am viewing a member's Lego collection

  # ── Setting build status ─────────────────────────────────────────────────────

  Scenario: Editor sets build status to "Built" from the detail sheet
    Given the Lego set "Millennium Falcon" has no build status
    When I open the detail sheet for "Millennium Falcon"
    And I tap the "🔨 Built" status button
    Then the build status badge on the item card updates to "🔨 Built"
    And a success toast appears

  Scenario: Editor changes build status from "Built" to "In box"
    Given the Lego set "Millennium Falcon" has build status "Built"
    When I open the detail sheet for "Millennium Falcon"
    And I tap the "📦 In box" status button
    Then the build status badge on the item card updates to "📦 In box"

  Scenario: Editor sets build status to "Apart" (disassembled)
    Given the Lego set "Death Star" has no build status
    When I open the detail sheet for "Death Star"
    And I tap the "🔧 Apart" status button
    Then the build status badge on the item card updates to "🔧 Apart"

  # ── Filter bar ───────────────────────────────────────────────────────────────

  Scenario: Filtering by build status shows only matching sets
    Given the Lego collection contains:
      | Set                | Status      |
      | Millennium Falcon  | built       |
      | Death Star         | in_box      |
      | Eiffel Tower       | disassembled|
    When I tap the "🔨 Built" filter button above the grid
    Then only "Millennium Falcon" is visible in the grid
    And "Death Star" is not visible
    And "Eiffel Tower" is not visible

  # ── Viewer restriction ────────────────────────────────────────────────────────

  Scenario: Viewer sees build status badge but cannot change it
    Given I am logged in as a viewer
    And the Lego set "Millennium Falcon" has build status "Built"
    When I open the detail sheet for "Millennium Falcon"
    Then the build status badge shows "🔨 Built"
    But the status buttons are not displayed
