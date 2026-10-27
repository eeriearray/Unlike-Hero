using UnityEngine;

namespace UnlikeHero.Karts
{
    // No Rigidbody/collider needed: swept sphere queries avoid tunnelling at high arcade speeds.
    public sealed class KartProjectile : MonoBehaviour
    {
        [SerializeField, Min(1)] float speed = 38;
        [SerializeField, Min(1)] float turnDegreesPerSecond = 260;
        [SerializeField, Min(0.05f)] float radius = 0.3f;
        [SerializeField, Min(0.1f)] float lifetime = 9;
        [Tooltip("Track + kart layers; exclude triggers and projectile visuals.")]
        [SerializeField] LayerMask collisionMask;
        ItemManager manager;
        RaceParticipant owner, target;
        bool leaderOnly, initialized;
        float expires;

        public void Initialize(ItemManager manager, RaceParticipant owner, RaceParticipant target, bool leaderOnly)
        {
            this.manager = manager; this.owner = owner; this.target = target; this.leaderOnly = leaderOnly;
            expires = Time.time + lifetime; initialized = true;
        }

        void FixedUpdate()
        {
            if (!initialized) return;
            if (Time.time >= expires || manager == null || !manager.ItemsEnabled) { Destroy(gameObject); return; }
            // Reacquire every tick: the hunter attacks the current first-place racer, never a former leader.
            if (leaderOnly) target = manager.FindLeader();
            if (leaderOnly && (target == null || target == owner)) { Destroy(gameObject); return; }
            if (target != null && target.Active)
            {
                Vector3 aim = target.Kart.Body.position - transform.position;
                if (aim.sqrMagnitude > 0.001f)
                    transform.rotation = Quaternion.RotateTowards(transform.rotation,
                        Quaternion.LookRotation(aim, Vector3.up), turnDegreesPerSecond * Time.fixedDeltaTime);
            }
            // SphereCast does not detect initial overlaps; check those separately (including spawn overlaps).
            foreach (var collider in Physics.OverlapSphere(transform.position, radius, collisionMask, QueryTriggerInteraction.Ignore))
                if (Impact(collider)) return;
            float travel = speed * Time.fixedDeltaTime;
            var hits = Physics.SphereCastAll(transform.position, radius, transform.forward, travel, collisionMask, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (var hit in hits) if (Impact(hit.collider)) return;
            transform.position += transform.forward * travel;
        }

        bool Impact(Collider collider)
        {
            var racer = collider.GetComponentInParent<RaceParticipant>();
            if (racer == owner) return false;
            if (racer != null)
            {
                if (!racer.Active || (leaderOnly && racer != target)) return false;
                racer.Kart.TryHit(); // Invincibility blocks damage, but still consumes the projectile.
            }
            Destroy(gameObject); // Terrain stops projectiles; no attacks through track walls.
            return true;
        }
    }
}
