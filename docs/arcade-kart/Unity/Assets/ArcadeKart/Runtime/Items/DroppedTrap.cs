using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(Collider))]
    public sealed class DroppedTrap : MonoBehaviour
    {
        RaceParticipant owner;
        float armedAt, expires;
        bool spent, initialized;
        public void Initialize(RaceParticipant racer)
        { owner = racer; armedAt = Time.time + 0.5f; expires = Time.time + 25; initialized = true; }
        void Awake() => GetComponent<Collider>().isTrigger = true;
        void Update() { if (initialized && Time.time >= expires) Destroy(gameObject); }
        void OnTriggerStay(Collider other)
        {
            if (!initialized || spent || Time.time < armedAt) return;
            var racer = other.GetComponentInParent<RaceParticipant>();
            if (racer == null || racer == owner || !racer.Active) return;
            spent = true; racer.Kart.TryHit(); Destroy(gameObject);
        }
    }
}
