using UnityEngine;

namespace UnlikeHero.Karts
{
    public sealed class AIManager : MonoBehaviour
    {
        [SerializeField] RaceProgressSource progress;
        [SerializeField] RaceParticipant referenceHuman;
        [SerializeField] RaceParticipant[] racers = System.Array.Empty<RaceParticipant>();
        [SerializeField, Min(0)] float deadZoneMetres = 15;
        [SerializeField, Min(1)] float fullEffectMetres = 100;
        [SerializeField, Range(0, 0.1f)] float maximumSpeedAdjustment = 0.06f;
        [SerializeField, Range(0, 0.1f)] float maximumAccelerationAdjustment = 0.08f;
        [SerializeField, Min(0.01f)] float blendPerSecond = 1;
        public bool RubberBandingEnabled { get; set; } = true;
        float[] speed, acceleration;

        void Awake()
        {
            speed = new float[racers.Length]; acceleration = new float[racers.Length];
            for (int i = 0; i < racers.Length; i++) speed[i] = acceleration[i] = 1;
        }
        void FixedUpdate()
        {
            RaceProgress human = default;
            bool hasHuman = RubberBandingEnabled && referenceHuman != null && referenceHuman.IsHuman &&
                referenceHuman.Active && progress != null && progress.TryRead(referenceHuman, out human) && human.Valid;
            for (int i = 0; i < racers.Length; i++)
            {
                var racer = racers[i];
                if (racer == null || racer.IsHuman) continue;
                float correction = 0;
                if (hasHuman && racer.Active && progress.TryRead(racer, out RaceProgress state) && state.Valid)
                {
                    float gap = human.Distance - state.Distance; // Positive means AI is behind.
                    correction = Correction(gap, deadZoneMetres, fullEffectMetres);
                }
                speed[i] = Mathf.MoveTowards(speed[i], 1 + correction * maximumSpeedAdjustment, blendPerSecond * Time.fixedDeltaTime);
                acceleration[i] = Mathf.MoveTowards(acceleration[i], 1 + correction * maximumAccelerationAdjustment, blendPerSecond * Time.fixedDeltaTime);
                racer.Kart.SetAIMultipliers(speed[i], acceleration[i]);
            }
        }
        public static float Correction(float signedGap, float deadZone, float fullEffect)
        {
            deadZone = Mathf.Max(0, deadZone);
            return Mathf.Sign(signedGap) * Mathf.InverseLerp(deadZone, Mathf.Max(deadZone + 1, fullEffect), Mathf.Abs(signedGap));
        }
        void OnDisable()
        {
            foreach (var racer in racers) if (racer != null && !racer.IsHuman && racer.Kart != null)
                racer.Kart.SetAIMultipliers(1, 1);
        }
    }
}
