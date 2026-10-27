using System;
using UnityEngine;

namespace UnlikeHero.Karts
{
    [RequireComponent(typeof(RaceParticipant))]
    public sealed class ItemInventory : MonoBehaviour
    {
        [SerializeField] ItemManager manager;
        public bool HasItem { get; private set; }
        public ItemKind HeldItem { get; private set; }
        public int Coins { get; private set; }
        public RaceParticipant Racer { get; private set; }
        public event Action Changed;
        float nextUse;
        void Awake() => Racer = GetComponent<RaceParticipant>();
        public bool TryCollect()
        {
            if (HasItem || manager == null || !Racer.Active || !manager.TryRoll(Racer, out ItemKind item)) return false;
            HeldItem = item; HasItem = true; Changed?.Invoke(); return true;
        }
        public bool TryUse()
        {
            if (!HasItem || manager == null || !Racer.Active || Time.time < nextUse) return false;
            if (!manager.TryExecute(this, HeldItem)) return false;
            HasItem = false; nextUse = Time.time + 0.15f;
            Changed?.Invoke(); return true;
        }
        internal void AddCoin() { Coins = Mathf.Min(99, Coins + 1); }
        public void Clear() { HasItem = false; nextUse = 0; Changed?.Invoke(); }
    }
}
