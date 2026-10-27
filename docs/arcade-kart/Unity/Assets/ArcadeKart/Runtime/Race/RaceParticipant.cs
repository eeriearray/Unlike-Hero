using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(KartController))]
    public sealed class RaceParticipant : MonoBehaviour
    {
        [SerializeField] int racerId;
        [SerializeField] bool human;
        public int RacerId => racerId;
        public bool IsHuman => human;
        public bool Finished { get; set; }
        public bool Eliminated { get; set; }
        public KartController Kart { get; private set; }
        public bool Active => isActiveAndEnabled && !Finished && !Eliminated;
        void Awake() => Kart = GetComponent<KartController>();
    }

    public readonly struct RaceProgress
    {
        public readonly int Placement, RacerCount;
        // Unwrapped metres: completed laps * lap length + validated distance in this lap.
        public readonly float Distance;
        public RaceProgress(int placement, int racerCount, float distance)
        { Placement = placement; RacerCount = racerCount; Distance = distance; }
        public bool Valid => RacerCount > 0 && Placement >= 1 && Placement <= RacerCount &&
            !float.IsNaN(Distance) && !float.IsInfinity(Distance);
    }

    // Implemented by the waypoint/checkpoint system AFTER the architecture review.
    // Provider publishes one coherent snapshot per tick; no Euclidean distance shortcuts.
    public abstract class RaceProgressSource : MonoBehaviour
    {
        public abstract bool TryRead(RaceParticipant racer, out RaceProgress progress);
    }
}
