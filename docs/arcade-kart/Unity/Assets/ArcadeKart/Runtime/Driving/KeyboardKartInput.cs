using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(KartController))]
    public sealed class KeyboardKartInput : MonoBehaviour
    {
        KartController kart;
        void Awake() => kart = GetComponent<KartController>();
        void Update()
        {
            KartInput input = default;
            bool use = false;
#if ENABLE_INPUT_SYSTEM
            var keys = Keyboard.current;
            if (keys != null)
            {
                input.throttle = (keys.wKey.isPressed ? 1 : 0) - (keys.sKey.isPressed ? 1 : 0);
                input.steering = (keys.dKey.isPressed ? 1 : 0) - (keys.aKey.isPressed ? 1 : 0);
                input.brake = keys.leftShiftKey.isPressed;
                input.driftHeld = keys.spaceKey.isPressed;
                use = keys.eKey.wasPressedThisFrame;
            }
#elif ENABLE_LEGACY_INPUT_MANAGER
            input.throttle = (Input.GetKey(KeyCode.W) ? 1 : 0) - (Input.GetKey(KeyCode.S) ? 1 : 0);
            input.steering = (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0);
            input.brake = Input.GetKey(KeyCode.LeftShift);
            input.driftHeld = Input.GetKey(KeyCode.Space);
            use = Input.GetKeyDown(KeyCode.E);
#endif
            kart.SetInput(input);
            if (use && TryGetComponent(out ItemInventory inventory)) inventory.TryUse();
        }
        void OnDisable() { if (kart != null) kart.SetInput(default); }
    }
}
