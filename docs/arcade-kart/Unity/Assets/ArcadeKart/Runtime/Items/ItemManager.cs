using UnityEngine;

namespace UnlikeHero.Karts
{
    public sealed class ItemManager : MonoBehaviour
    {
        [SerializeField] ItemTable table;
        [SerializeField] RaceProgressSource progress;
        [SerializeField] RaceParticipant[] racers = System.Array.Empty<RaceParticipant>();
        [SerializeField] KartProjectile projectilePrefab;
        [SerializeField] DroppedTrap trapPrefab;
        [SerializeField] int randomSeed = 173;
        public bool ItemsEnabled { get; set; } = true;
        System.Random random;

        void Awake() => random = new System.Random(randomSeed);

        public bool TryRoll(RaceParticipant racer, out ItemKind item)
        {
            item = ItemKind.Coin;
            if (!ItemsEnabled || racer == null || !racer.Active || table == null || progress == null ||
                !progress.TryRead(racer, out RaceProgress state) || !state.Valid) return false;
            item = table.Roll(state.Placement, state.RacerCount, random);
            return true;
        }

        // Called only by the authoritative race host. In online play, clients send intent, never item results.
        internal bool TryExecute(ItemInventory inventory, ItemKind item)
        {
            if (!ItemsEnabled || inventory == null || !inventory.Racer.Active) return false;
            var racer = inventory.Racer;
            var kart = racer.Kart;
            if (kart.IsSpinning) return false;
            switch (item)
            {
                case ItemKind.Coin: inventory.AddCoin(); return true;
                case ItemKind.SpeedBoost: kart.Boost(9, 1.3f, 12); return true;
                case ItemKind.Invincibility:
                    kart.GrantInvincibility(7); kart.Boost(6, 7, 8); return true;
                case ItemKind.Overdrive:
                    // Navigation is explicitly injected; retaining the item is safer than blind autopilot.
                    if (!kart.TryGetComponent(out KartAutopilotPort pilot) || !pilot.Available) return false;
                    pilot.BeginAutopilot(5);
                    kart.GrantInvincibility(5); kart.Boost(15, 5, 18); return true;
                case ItemKind.Trap:
                    if (trapPrefab == null) return false;
                    var trap = Instantiate(trapPrefab, kart.Body.position - kart.transform.forward * 1.6f, Quaternion.identity);
                    trap.Initialize(racer); return true;
                case ItemKind.Bolt: return Fire(racer, null, false, 1);
                case ItemKind.TripleBolt: return Fire(racer, null, false, 3);
                case ItemKind.HomingBolt:
                    var target = FindAhead(racer);
                    return target != null && Fire(racer, target, false, 1);
                case ItemKind.LeaderHunter:
                    var leader = FindLeader();
                    return leader != null && leader != racer && Fire(racer, leader, true, 1);
                default: return false;
            }
        }

        bool Fire(RaceParticipant owner, RaceParticipant target, bool leaderOnly, int count)
        {
            if (projectilePrefab == null) return false;
            for (int i = 0; i < count; i++)
            {
                float angle = count == 1 ? 0 : (i - 1) * 12;
                Quaternion rotation = Quaternion.AngleAxis(angle, owner.transform.up) * owner.transform.rotation;
                var shot = Instantiate(projectilePrefab, owner.Kart.Body.position + rotation * Vector3.forward * 1.3f, rotation);
                shot.Initialize(this, owner, target, leaderOnly);
            }
            return true;
        }

        public RaceParticipant FindLeader()
        {
            if (progress == null) return null;
            foreach (var racer in racers)
                if (racer != null && racer.Active && progress.TryRead(racer, out RaceProgress state) && state.Valid && state.Placement == 1)
                    return racer;
            return null;
        }

        RaceParticipant FindAhead(RaceParticipant owner)
        {
            if (progress == null || !progress.TryRead(owner, out RaceProgress own) || !own.Valid) return null;
            RaceParticipant best = null;
            float smallestGap = float.PositiveInfinity;
            foreach (var racer in racers)
            {
                if (racer == null || racer == owner || !racer.Active ||
                    !progress.TryRead(racer, out RaceProgress state) || !state.Valid || state.Placement >= own.Placement) continue;
                float gap = state.Distance - own.Distance;
                if (gap >= 0 && gap < smallestGap) { smallestGap = gap; best = racer; }
            }
            return best;
        }
    }

    // Implement this alongside AI navigation in phase two. A single input arbiter must own SetInput.
    public abstract class KartAutopilotPort : MonoBehaviour
    {
        public abstract bool Available { get; }
        public abstract void BeginAutopilot(float seconds);
    }
}
