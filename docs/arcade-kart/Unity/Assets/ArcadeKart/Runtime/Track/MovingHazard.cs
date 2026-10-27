using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(Rigidbody), typeof(Collider))]
    public sealed class MovingHazard : MonoBehaviour
    {
        [SerializeField] Vector3 travel = new Vector3(6, 0, 0);
        [SerializeField, Min(0.1f)] float period = 4;
        [SerializeField, Min(0.1f)] float spinSeconds = 1.1f;
        [SerializeField, Range(0, 1)] float retainedMomentum = 0.25f;
        Rigidbody body;
        Vector3 origin;
        float started;
        void Awake()
        {
            body = GetComponent<Rigidbody>(); body.isKinematic = true;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            GetComponent<Collider>().isTrigger = true;
            origin = body.position; started = Time.time;
        }
        void FixedUpdate() => body.MovePosition(origin + travel * (0.5f - 0.5f * Mathf.Cos((Time.time - started) * 2 * Mathf.PI / period)));
        void OnTriggerStay(Collider other)
        {
            var kart = other.GetComponentInParent<KartController>();
            if (kart != null) kart.TryHit(spinSeconds, retainedMomentum);
        }
    }
}
