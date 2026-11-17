/* BUILD-G1 DRAFT_BALANCE — 플레이테스트 전 가안. 기존 P0-R 상수(K)와 병합하지 않고 내정 모듈만 읽는다.
   출처: BUILD_G1_DRAFT_BALANCE_v0.1.json + 05-2-G01. `g1Added`로 표시한 키는 이번 빌드에서 덧붙인 가안이다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DraftBalance = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    _meta: { project: '후삼국: 천하의 주인', version: 'BUILD-G1/0.1', balanceStatus: 'DRAFT_BALANCE_NOT_APPROVED', scenario: 'S04_0929_10' },
    administration: {
      baseCapacity: 4, politicsCapacityFactor: 0.08, burdenDirect: 1.8, burdenAutonomous: 0.65,
      weeklyGoldCostDirect: 4, weeklyGoldCostAutonomous: 1,
      collectionEfficiencyFloor: 0.65, collectionOverextensionFactor: 0.35,
      reformCapacityBonusSOC03: 2, grievanceThresholds: [25, 50, 70, 85], instantRebellionOnGovernanceChange: false,
      // g1Added ↓
      capitalExempt: true,                                   // 본거지는 행정 유지비를 내지 않는다
      scenarioCapacityBonus: { hubaekje: 4.5 }, // 929년 시작 판도가 과부하로 시작하지 않게 하는 초기 보정
      selfRuleAutonomy: 50,                                  // 자기 거점의 자치도(기존 Region.autonomy)가 이 값 이상이면 지방 자치로 본다
      delegatedAutonomy: 60, directAutonomy: 15, transitionWeeks: 4,
      grievance: { consentDirect: 4, forcedDirect: 15, ownDirect: 6, reassure: -10, overloadMax: 4, lowStabilityMax: 3, recoveryMax: 3, directOngoing: 1, forcedTrust: -15, reassureTrust: 5 },
      grievanceTrustDrain: [0, 0, 1, 2, 3],                  // 불만 단계(0~4)별 월간 신뢰 하락
    },
    officers: {
      governorSlotsPerCity: 1, deputySlotsPerCity: 2, baselineOfficerEfficiencyWhenEmpty: 1.0,
      governorEfficiencyAtPolitics50: 1.0, governorEfficiencyFloor: 0.9, governorEfficiencyCeil: 1.1,
      focusBonus: 0.1, firstDeputySpecialistBonus: 0.08, secondSameDomainDeputyBonus: 0.04, duplicatePrimaryAssignmentsAllowed: false,
      // g1Added ↓ 부관 보정에 적성을 곱한다(적성 60 = 1.0, 0.5~1.25). 누구를 앉히느냐가 의미를 갖게 하는 가안
      deputyFitScaling: true, deputyFitRef: 60, deputyFitMin: 0.5, deputyFitMax: 1.25,
      projectOfficerBase: 0.8, projectOfficerDiv: 250,
      roleFit: {
        commerce: { po: 0.7, pr: 0.3 }, agriculture: { po: 0.6, st: 0.4 }, military: { ld: 0.7, ma: 0.3 }, security: { ld: 0.4, po: 0.4, pr: 0.2 }, culture: { pr: 0.6, po: 0.4 },
        governor: { po: 1 }, MIL: { ld: 0.6, st: 0.4 }, SOC: { po: 1 }, PRJ: { po: 0.7, pr: 0.3 }, commander: { ld: 0.6, ma: 0.2, st: 0.2 }, armyDeputy: { ma: 0.5, st: 0.5 },
      },
    },
    cityFacilities: {
      maxLevel: 3, goldCostByNewLevel: [null, 60, 120, 180], constructionWeeks: 4, weeklyUpkeepPerLevel: 1,
      commerceGoldEfficiencyBonusPerLevel: 0.06, agricultureExistingHarvestBonusPerLevel: 0.06,
      trainingMonthlyChangePerLevel: 1, stabilityMonthlyChangePerLevel: 1, wellbeingMonthlyChangePerLevel: 1,
      facilityIds: ['market', 'irrigation', 'barracks', 'guardpost', 'temple_relief'],
      trainingBattleFactorPerPoint: 0.002,                   // g1Added: 훈련도 50 기준 ±1당 전투 보정 0.2% (엔진 trF와 같은 값)
    },
    national: {
      activeSlotsByCategory: { MIL: 1, SOC: 1, PRJ: 1 },
      monthlyBaseProgressPoints: { MIL: 18, SOC: 18, PRJ: 12 },
      budgetTiers: {
        ECONOMY: { goldMonthly: 20, speedMultiplier: 0.70 },
        STANDARD: { goldMonthly: 40, speedMultiplier: 1.00 },
        CONCENTRATED_BUDGET: { goldMonthly: 70, speedMultiplier: 1.25 },
      },
      initialPrototypeContent: { MIL: ['MIL-01', 'MIL-02'], SOC: ['SOC-01', 'SOC-03'], PRJ: ['PRJ-02'] },
      unitMil02: { id: 'advanced_heavy_inf', codeId: 'adv', powerMultiplier: 1.45, recruitGoldPer100: 40, upkeepGrainPer100PerWeek: 18, minBarracksLevel: 1, equipmentSupplyModel: 'ABSTRACTED_G1_ONLY', legacyUnitHeavyInfRemainAvailable: true, automaticUnitConversion: false },
      projectPRJ02: { existingHarvestBonusWhenCompleted: 0.10 },
      socialPolicySOC03: { administrationCapacityBonusWhenEnacted: 2, requiresSeparateEnact: true },
      mil01RecruitWeeks: 1,                                  // g1Added: MIL-01 완료 효과(모병 2주 → 1주)
      soc01GrievanceRelief: 1,                               // g1Added: SOC-01 완료 효과(월간 불만 완화 +1)
    },
    calendar: { monthlyAutoPauseDefault: true, fixedFourWeekMonths: false, settleExactlyOncePerScenarioFactionMonth: true, monthlyReviewRegeneratesGoldOrGrain: false, monthlyReviewCommandsApplyOnNextUnprocessedTick: true },
    testing: {
      primaryValidationWeeksMin: 12, primaryValidationWeeksMax: 14, legacyCampaignWeeks: 60,
      devOnlyFastResearchFixture: { enabledInProduction: false, mil01Completed: true, mil02ProgressPct: 64, soc01Completed: true, soc03ProgressPct: 64 },
      productionDeploymentAllowed: false,
    },
    // 문서의 ID와 코드의 ID 대응 (외부 참조 ID 보존)
    mapping: { units: { light_inf: 'light', heavy_inf: 'heavy', archer: 'archer', cavalry: 'cav', advanced_heavy_inf: 'adv' }, region: { controllerId: 'controller', nominalOverlordId: 'overlord', localLordId: 'lord' } },
  };
});
