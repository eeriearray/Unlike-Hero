using System.Collections.Generic;
using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(Collider))]
    public sealed class SurfaceVolume : MonoBehaviour
    {
        [SerializeField, Range(0.1f, 1)] float maximumSpeedMultiplier = 0.55f;
        readonly Dictionary<KartController, HashSet<Collider>> occupants = new Dictionary<KartController, HashSet<Collider>>();
        void Awake() => GetComponent<Collider>().isTrigger = true;
        void OnTriggerEnter(Collider other) => Track(other);
        void OnTriggerStay(Collider other) => Track(other); // Restores state after respawn or volume re-enable.
        void Track(Collider other)
        {
            var kart = other.GetComponentInParent<KartController>();
            if (kart == null) return;
            if (!occupants.TryGetValue(kart, out var colliders))
            { colliders = new HashSet<Collider>(); occupants.Add(kart, colliders); }
            colliders.Add(other);
            kart.SetSurface(this, maximumSpeedMultiplier);
        }
        void OnTriggerExit(Collider other)
        {
            var kart = other.GetComponentInParent<KartController>();
            if (kart == null || !occupants.TryGetValue(kart, out var colliders)) return;
            colliders.Remove(other);
            if (colliders.Count != 0) return;
            kart.RemoveSurface(this); occupants.Remove(kart);
        }
        void OnDisable()
        {
            foreach (var pair in occupants) if (pair.Key != null) pair.Key.RemoveSurface(this);
            occupants.Clear();
        }
    }
}
