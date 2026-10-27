using System;
using System.Collections.Generic;
using UnityEngine;

namespace UnlikeHero.Karts
{
    public struct KartInput
    {
        public float throttle; // -1 reverse, +1 forward
        public float steering; // -1 left, +1 right
        public bool brake;
        public bool driftHeld;
    }

    [RequireComponent(typeof(Rigidbody), typeof(SphereCollider))]
    public sealed class KartController : MonoBehaviour
    {
        [SerializeField] KartTuning tuning;
        [Tooltip("Track-only mask. Exclude karts, items, and triggers.")]
        [SerializeField] LayerMask groundMask;
        [SerializeField, Min(0.01f)] float groundTolerance = 0.09f;
        [SerializeField, Range(0, 75)] float maximumSlope = 60;
        [SerializeField] Transform visualRoot;

        public Rigidbody Body { get; private set; }
        public bool Grounded { get; private set; }
        public bool IsDrifting { get; private set; }
        public int TurboLevel { get; private set; }
        public float DriftSeconds { get; private set; }
        public float DriftAngle { get; private set; }
        public bool IsBoosting => Time.time < boostUntil;
        public bool IsInvincible => Time.time < invincibleUntil;
        public bool IsSpinning => Time.time < spinUntil;
        public float PlanarSpeed => Vector3.ProjectOnPlane(Body.linearVelocity, groundNormal).magnitude;
        public event Action<int> TurboLevelChanged;
        public event Action JumpBoosted;
        public event Action Hit;

        readonly Dictionary<UnityEngine.Object, float> surfaces = new Dictionary<UnityEngine.Object, float>();
        KartInput input;
        SphereCollider sphere;
        Vector3 groundNormal = Vector3.up;
        Quaternion visualRest;
        bool previousDriftHeld, pressQueued, pressWasAirborne, releaseQueued, driftRequested, trickEligible;
        float lastAirPress = float.NegativeInfinity, airStarted, ignoreGroundUntil;
        float driftRequestUntil, boostUntil, boostAllowance, invincibleUntil, spinUntil, hitGraceUntil;
        float pendingBoost, pendingRetention = 1, aiSpeed = 1, aiAcceleration = 1;
        int driftDirection;

        void Awake()
        {
            Body = GetComponent<Rigidbody>();
            sphere = GetComponent<SphereCollider>();
            if (tuning == null || groundMask.value == 0)
            {
                Debug.LogError("Assign KartTuning and a track-only Ground Mask.", this);
                enabled = false;
                return;
            }
            Body.mass = tuning.mass;
            Body.useGravity = false;
            Body.constraints = RigidbodyConstraints.FreezeRotation;
            Body.linearDamping = 0;
            Body.angularDamping = 0;
            Body.interpolation = RigidbodyInterpolation.Interpolate;
            Body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            if (visualRoot != null) visualRest = visualRoot.localRotation;
        }

        // Call from Update (player), FixedUpdate (AI), or an authoritative input adapter.
        // Edges remain latched until the next physics step; they cannot disappear at high render FPS.
        public void SetInput(KartInput value)
        {
            value.throttle = Mathf.Clamp(value.throttle, -1, 1);
            value.steering = Mathf.Clamp(value.steering, -1, 1);
            if (value.driftHeld && !previousDriftHeld)
            {
                pressQueued = true;
                pressWasAirborne = !Grounded;
                if (!Grounded) lastAirPress = Time.time;
            }
            if (!value.driftHeld && previousDriftHeld) releaseQueued = true;
            previousDriftHeld = value.driftHeld;
            input = value;
        }

        public void SetAIMultipliers(float speed, float acceleration)
        {
            aiSpeed = Mathf.Clamp(speed, 0.9f, 1.1f);
            aiAcceleration = Mathf.Clamp(acceleration, 0.9f, 1.1f);
        }

        public void SetSurface(UnityEngine.Object source, float speedMultiplier) =>
            surfaces[source] = Mathf.Clamp(speedMultiplier, 0.1f, 1);
        public void RemoveSurface(UnityEngine.Object source) => surfaces.Remove(source);

        // Velocity change has the same driving feel for all masses. Collision response still uses mass.
        // Queued impulses are consumed only in FixedUpdate. Multiple boosts do not stack without bound.
        public void Boost(float velocityChange, float duration, float extraSpeed)
        {
            float previousAllowance = IsBoosting ? boostAllowance : 0;
            pendingBoost = Mathf.Max(pendingBoost, Mathf.Max(0, velocityChange));
            boostUntil = Mathf.Max(boostUntil, Time.time + Mathf.Max(0, duration));
            boostAllowance = Mathf.Max(previousAllowance, Mathf.Max(0, extraSpeed));
        }

        public void GrantInvincibility(float duration) =>
            invincibleUntil = Mathf.Max(invincibleUntil, Time.time + Mathf.Max(0, duration));

        public bool TryHit(float spinSeconds = 1.1f, float retainedMomentum = 0.3f)
        {
            if (IsInvincible || Time.time < hitGraceUntil) return false;
            spinUntil = Time.time + Mathf.Max(0.1f, spinSeconds);
            hitGraceUntil = spinUntil + 0.4f;
            pendingRetention = Mathf.Min(pendingRetention, Mathf.Clamp01(retainedMomentum));
            boostUntil = 0; pendingBoost = 0; boostAllowance = 0;
            EndDrift(false);
            Hit?.Invoke(); // Battle mode subscribes here to remove one balloon.
            return true;
        }

        void FixedUpdate()
        {
            float dt = Time.fixedDeltaTime;
            float now = Time.time;
            bool wasGrounded = Grounded;
            Grounded = ProbeGround(out Vector3 normal) && now >= ignoreGroundUntil;
            groundNormal = Grounded ? normal : Vector3.up;
            if (wasGrounded && !Grounded) { airStarted = now; trickEligible = true; }
            if (!wasGrounded && Grounded)
            {
                if (trickEligible && !IsSpinning && now - airStarted >= tuning.minimumTrickAirTime &&
                    now - lastAirPress <= tuning.landingInputWindow)
                {
                    Boost(tuning.jumpBoostVelocity, 0.65f, 7);
                    JumpBoosted?.Invoke();
                }
                lastAirPress = float.NegativeInfinity;
                trickEligible = false;
            }

            Vector3 forward = Vector3.ProjectOnPlane(Body.rotation * Vector3.forward, groundNormal).normalized;
            if (forward.sqrMagnitude < 0.5f) forward = Vector3.forward;
            Vector3 velocity = Body.linearVelocity;
            float normalSpeed = Vector3.Dot(velocity, groundNormal);
            Vector3 planar = Vector3.ProjectOnPlane(velocity, groundNormal) * pendingRetention;
            pendingRetention = 1;

            if (pressQueued && !pressWasAirborne && Grounded && !IsSpinning)
            {
                normalSpeed = Mathf.Max(normalSpeed, tuning.hopVelocity);
                Grounded = false; airStarted = now; ignoreGroundUntil = now + 0.12f;
                trickEligible = false; // A hop cannot farm landing tricks; ramps/track bumps can.
                driftRequested = Mathf.Abs(input.steering) > 0.2f && planar.magnitude >= tuning.minimumDriftSpeed;
                driftDirection = input.steering >= 0 ? 1 : -1;
                driftRequestUntil = now + 0.7f;
            }
            pressQueued = false;
            if (releaseQueued) { EndDrift(!IsSpinning); driftRequested = false; }
            releaseQueued = false;
            if (driftRequested && Grounded && input.driftHeld && now <= driftRequestUntil && !IsSpinning)
            { IsDrifting = true; driftRequested = false; }
            if (now > driftRequestUntil) driftRequested = false;
            if (IsDrifting && (!input.driftHeld || IsSpinning || planar.magnitude < tuning.minimumDriftSpeed))
                EndDrift(false);

            float steering = IsSpinning ? 0 : input.steering;
            if (IsDrifting) steering = driftDirection * Mathf.Clamp(0.7f + steering * driftDirection * 0.4f, 0.3f, 1.1f);
            float signedSpeed = Vector3.Dot(planar, forward);
            float turn = steering * tuning.turnDegreesPerSecond * Mathf.Clamp01(planar.magnitude / 8) * dt;
            if (signedSpeed < -0.5f) turn = -turn;
            if (!Grounded) turn *= 0.3f;
            forward = Quaternion.AngleAxis(turn, groundNormal) * forward;
            Body.MoveRotation(Quaternion.LookRotation(forward, groundNormal));

            float surfaceMultiplier = 1;
            if (!IsBoosting) foreach (float modifier in surfaces.Values) surfaceMultiplier = Mathf.Min(surfaceMultiplier, modifier);
            float maximum = tuning.topSpeed * aiSpeed * surfaceMultiplier + (IsBoosting ? boostAllowance : 0);
            if (!IsBoosting) boostAllowance = 0;
            if (pendingBoost > 0 && !IsSpinning)
            {
                // An instantaneous forward velocity impulse, bounded by this boost's speed envelope.
                float available = Mathf.Max(0, maximum - Vector3.Dot(planar, forward));
                planar += forward * Mathf.Min(pendingBoost, available);
            }
            pendingBoost = 0;

            if (Grounded && !IsSpinning)
            {
                Vector3 driveDirection = IsDrifting
                    ? Quaternion.AngleAxis(-driftDirection * tuning.driftSlipDegrees, groundNormal) * forward : forward;
                Vector3 right = Vector3.Cross(groundNormal, driveDirection).normalized;
                float grip = IsDrifting ? tuning.driftGrip : tuning.lateralGrip;
                planar -= right * Vector3.Dot(planar, right) * (1 - Mathf.Exp(-grip * dt));
                float throttle = input.throttle;
                float speed = Vector3.Dot(planar, forward);
                if (input.brake)
                    planar = Vector3.MoveTowards(planar, Vector3.zero, tuning.braking * dt);
                else if (Mathf.Abs(throttle) > 0.01f)
                {
                    float target = throttle >= 0 ? maximum * throttle : -maximum * 0.35f * -throttle;
                    float rate = speed * throttle < 0 ? tuning.braking : tuning.acceleration * aiAcceleration;
                    // Natural soft cap: no per-frame normalization erasing lateral collision momentum.
                    planar += forward * (Mathf.MoveTowards(speed, target, rate * dt) - speed);
                }
                else planar = Vector3.MoveTowards(planar, Vector3.zero, tuning.coastDeceleration * dt);
            }
            Body.linearVelocity = planar + groundNormal * normalSpeed;
            Body.AddForce(Vector3.down * tuning.gravity, ForceMode.Acceleration);
            if (Grounded) Body.AddForce(-groundNormal * tuning.groundStickAcceleration, ForceMode.Acceleration);

            if (IsDrifting && Grounded)
            {
                DriftAngle = planar.sqrMagnitude > 0.1f ? Vector3.SignedAngle(planar, forward, groundNormal) : 0;
                if (DriftAngle * driftDirection >= 5 && Mathf.Abs(DriftAngle) <= 75)
                    DriftSeconds += dt;
                SetTurboLevel(DriftSeconds >= tuning.turboLevel3Seconds ? 3 :
                    DriftSeconds >= tuning.turboLevel2Seconds ? 2 : DriftSeconds >= tuning.turboLevel1Seconds ? 1 : 0);
            }
        }

        bool ProbeGround(out Vector3 normal)
        {
            // Uniform, positive root scale is required; start inside the physical sphere, above its bottom.
            float radius = sphere.radius * transform.lossyScale.x;
            Vector3 center = transform.TransformPoint(sphere.center);
            bool hit = Physics.SphereCast(center, radius * 0.85f, Vector3.down, out RaycastHit ground,
                radius * 0.15f + groundTolerance, groundMask, QueryTriggerInteraction.Ignore);
            normal = hit ? ground.normal : Vector3.up;
            return hit && Vector3.Angle(normal, Vector3.up) <= maximumSlope && Vector3.Dot(Body.linearVelocity, normal) <= 2;
        }

        void SetTurboLevel(int value)
        {
            if (value == TurboLevel) return;
            TurboLevel = value;
            TurboLevelChanged?.Invoke(value);
        }

        void EndDrift(bool reward)
        {
            int level = TurboLevel;
            IsDrifting = false; DriftSeconds = 0; DriftAngle = 0;
            SetTurboLevel(0);
            if (reward && level > 0) Boost(3 + level * 2, 0.35f + level * 0.3f, 4 + level * 3);
        }

        void LateUpdate()
        {
            if (visualRoot != null)
                visualRoot.localRotation = visualRest * Quaternion.Euler(0, IsSpinning ? (spinUntil - Time.time) * 900 : 0, 0);
        }

        // Respawn owner also resets its checkpoint state; call after teleporting the Rigidbody.
        public void ResetTransientState()
        {
            input = default; previousDriftHeld = pressQueued = releaseQueued = driftRequested = false;
            boostUntil = spinUntil = invincibleUntil = hitGraceUntil = ignoreGroundUntil = 0;
            pendingBoost = boostAllowance = 0; pendingRetention = 1;
            lastAirPress = float.NegativeInfinity; Grounded = false; trickEligible = false; airStarted = Time.time;
            surfaces.Clear(); EndDrift(false);
            Body.linearVelocity = Vector3.zero; Body.angularVelocity = Vector3.zero;
        }
    }
}
