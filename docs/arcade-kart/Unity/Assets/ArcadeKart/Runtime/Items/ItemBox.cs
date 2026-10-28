using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(Collider))]
    public sealed class ItemBox : MonoBehaviour
    {
        [SerializeField, Min(0.1f)] float respawnSeconds = 3;
        [SerializeField] GameObject visual;
        [SerializeField] ItemManager manager;
        float availableAt;
        void Awake() => GetComponent<Collider>().isTrigger = true;
        void Update()
        {
            if (visual != null) visual.SetActive(manager != null && manager.ItemsEnabled && Time.time >= availableAt);
        }
        void OnTriggerEnter(Collider other)
        {
            if (manager == null || !manager.ItemsEnabled || Time.time < availableAt) return;
            var inventory = other.GetComponentInParent<ItemInventory>();
            if (inventory == null || !inventory.TryCollect()) return;
            availableAt = Time.time + respawnSeconds;
        }
    }
}
