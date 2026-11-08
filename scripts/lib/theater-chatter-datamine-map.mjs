/**
 * Wiki Chatter / Eliminations categories → HeroVoice extract folders.
 * Disclaimer strings must match chatterCategoryFilter classification.
 */

/** @typedef {{ folder: string, disclaimer: string }} ChatterDatamineSource */

/** Core categories rebuilt from extract for every hero. */
export const THEATER_CHATTER_DATAMINE_SOURCES = /** @type {ChatterDatamineSource[]} */ ([
    { folder: 'SetupHere', disclaimer: '' }, // Set-Up Chatter
    { folder: 'HeroSelect', disclaimer: 'Hero Selected' },
    { folder: 'MatchStartTalk', disclaimer: 'Match Start' },
    { folder: 'Match/MatchStartRoundWin', disclaimer: 'Won Previous Round' },
    { folder: 'Match/MatchStartRoundLoss', disclaimer: 'Lost Previous Round' },
    { folder: 'Match/MatchStartFinalRound', disclaimer: 'Final Round' },
    { folder: 'Respawn', disclaimer: 'Respawn' },
    { folder: 'NanoBoosted', disclaimer: 'Nano Boosted' },
    { folder: 'OnFire', disclaimer: 'On Fire' },
    { folder: 'HealthPack', disclaimer: 'Health Pack' },
    { folder: 'DamageBoosted', disclaimer: 'Damage Boosted' },
    { folder: 'HealthRestoredFriendly', disclaimer: 'Fully Healed' },
    { folder: 'Resurrected', disclaimer: 'Resurrected' },
    { folder: 'EnemyResurrect', disclaimer: 'Enemy Resurrected' },
    { folder: 'VotedEpic', disclaimer: 'Voted Epic' },
    { folder: 'VotedLegendary', disclaimer: 'Voted Legendary' },
    { folder: 'Discorded', disclaimer: 'Negative Status' },
    { folder: 'Elimination', disclaimer: 'Elimination — Final Blow' },
    { folder: 'KillStreak', disclaimer: 'Elimination — Kill Streak' },
    { folder: 'Multikill', disclaimer: 'Elimination — Multi Kill' },
    { folder: 'TeamKill', disclaimer: 'Elimination — Team Kill' },
    { folder: 'Revenge', disclaimer: 'Elimination — Revenge' },
    { folder: 'MeleeEnemyKilledRemark', disclaimer: 'Elimination — Melee Final Blow' },
    { folder: 'Turret/EnemyTurretDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'Teleporter/EnemyTeleporterDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'ShieldGenerator/EnemyShieldGenDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'Teammate/KillSeen', disclaimer: 'Elimination — Final Blow Compliment' },
    { folder: 'LookingAtEarth', disclaimer: 'Looking At Earth' },
]);

/** Exact disclaimers replaced on each reimport (empty = Set Up). */
export const THEATER_CHATTER_CORE_DISCLAIMERS = new Set(
    THEATER_CHATTER_DATAMINE_SOURCES.map((s) => s.disclaimer),
);

/** Manifest hero id → HeroVoice folder. */
export const THEATER_CHATTER_EXTRACT_ALIASES = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
};


/** Manifest hero id → Theater voice filename prefix (Hero_-_Line.ogg). */
export const THEATER_CHATTER_VOICE_PREFIX = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_76',
    'Wrecking Ball': 'Wrecking_Ball',
    'Junker Queen': 'Junker_Queen',
    'Jetpack Cat': 'Jetpack_Cat',
};
