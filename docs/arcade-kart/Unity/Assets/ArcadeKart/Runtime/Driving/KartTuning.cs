using UnityEngine;

namespace UnlikeHero.Karts
{
    public enum WeightClass { Light, Medium, Heavy }

    [CreateAssetMenu(menuName = "Unlike Hero/Karts/Kart Tuning")]
    public sealed class KartTuning : ScriptableObject
    {
        public WeightClass weightClass = WeightClass.Medium;
        [Min(1)] public float mass = 140;
        [Min(1)] public float topSpeed = 25;
        [Min(1)] public float acceleration = 15;
        [Min(1)] public float turnDegreesPerSecond = 110;
        [Min(1)] public float braking = 28;
        [Min(0)] public float coastDeceleration = 2;
        [Min(0)] public float lateralGrip = 9;
        [Min(0)] public float driftGrip = 3;
        [Min(0)] public float hopVelocity = 4;
        [Min(0)] public float minimumDriftSpeed = 7;
        [Range(5, 45)] public float driftSlipDegrees = 22;
        [Min(0)] public float gravity = 24;
        [Min(0)] public float groundStickAcceleration = 10;
        [Min(0)] public float jumpBoostVelocity = 5;
        [Min(0.01f)] public float landingInputWindow = 0.16f;
        [Min(0.01f)] public float minimumTrickAirTime = 0.24f;
        [Min(0.01f)] public float turboLevel1Seconds = 0.6f;
        [Min(0.01f)] public float turboLevel2Seconds = 1.4f;
        [Min(0.01f)] public float turboLevel3Seconds = 2.3f;

        public void ApplyPreset(WeightClass value)
        {
            weightClass = value;
            switch (value)
            {
                case WeightClass.Light:
                    mass = 90; topSpeed = 22; acceleration = 19; turnDegreesPerSecond = 135; break;
                case WeightClass.Heavy:
                    mass = 220; topSpeed = 29; acceleration = 11; turnDegreesPerSecond = 88; break;
                default:
                    mass = 140; topSpeed = 25; acceleration = 15; turnDegreesPerSecond = 110; break;
            }
        }
    }
}
