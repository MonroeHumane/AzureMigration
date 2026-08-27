/* ─── Adoptédex integration: discoveries + distance-milestone rewards ─────
   Uses the shared window.MonroeAdoptedex client (dex-shared.js) exactly the
   way match.js does for its LEVEL_MILESTONES - see the invariant below,
   which was a real bug in both Match and Flappy Cat before being fixed:
   the reward UI must only render when the SERVER confirms claimed:true,
   never just because the client thinks a milestone was crossed. */

var ShelterRunDex = (function () {
  var CLAIMED_KEY = 'monroe_shelter_run_claimed_distances';

  function getParams() {
    if (typeof MonroeAdoptedex !== 'undefined') {
      return MonroeAdoptedex.getParams();
    }
    return { dexUser: '', dexDisplay: '', dexApi: '' };
  }

  function readClaimed() {
    try {
      return JSON.parse(localStorage.getItem(CLAIMED_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function writeClaimed(list) {
    try {
      localStorage.setItem(CLAIMED_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /**
   * Reports every pet collected during a run, batched into one call at
   * run-end rather than one network call per pickup (same "don't hammer
   * the server" philosophy as match.js's recordMatchForStats()).
   */
  function reportDiscoveries(petIds) {
    if (typeof MonroeAdoptedex === 'undefined' || !petIds || !petIds.length) {
      return Promise.resolve(null);
    }
    var p = getParams();
    if (!p.dexUser) {
      return Promise.resolve(null);
    }
    return MonroeAdoptedex.discoverBulk(p.dexApi, p.dexUser, petIds, 'shelter_run')
      .catch(function (e) {
        console.warn('[Shelter Run] discovery failed:', e);
        return null;
      });
  }

  /**
   * Claims every distance milestone crossed this run that isn't already
   * claimed locally (a lucky run can jump past one). The local array is
   * only a network-call-avoidance optimization - the server's unique key
   * on (profile, game_id, reward_key) is the actual dedup, so a stale or
   * cleared localStorage just means a redundant claim call that comes back
   * claimed:false, not a duplicate reward.
   *
   * @param {number} finalDistanceMeters
   * @param {function(object)} onClaimed - called once per newly-claimed
   *   milestone, {tier, rewardKey}, only after server confirms claimed:true.
   */
  function claimMilestones(finalDistanceMeters, onClaimed) {
    if (typeof MonroeAdoptedex === 'undefined') return;
    var p = getParams();
    if (!p.dexUser) return;

    var claimed = readClaimed();
    var thresholds = Object.keys(CFG.DISTANCE_MILESTONES)
      .map(Number)
      .filter(function (m) { return m <= finalDistanceMeters; })
      .sort(function (a, b) { return a - b; });

    thresholds.forEach(function (threshold) {
      if (claimed.indexOf(threshold) !== -1) return;
      var milestone = CFG.DISTANCE_MILESTONES[threshold];

      MonroeAdoptedex.claimReward(p.dexApi, p.dexUser, 'shelter_run', milestone.rewardKey, {
        tier: milestone.tier,
        count: 1,
      }).then(function (result) {
        if (result && result.claimed) {
          claimed.push(threshold);
          writeClaimed(claimed);
          if (typeof onClaimed === 'function') {
            onClaimed({ tier: milestone.tier, rewardKey: milestone.rewardKey, threshold: threshold });
          }
        }
      }).catch(function (e) {
        console.warn('[Shelter Run] claim failed for ' + milestone.rewardKey + ':', e);
      });
    });
  }

  return {
    getParams: getParams,
    reportDiscoveries: reportDiscoveries,
    claimMilestones: claimMilestones,
  };
})();
