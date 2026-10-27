using System;
using System.Collections.Generic;
using UnityEngine;

namespace UnlikeHero.Karts
{
    public enum ItemKind { Coin, Trap, Bolt, HomingBolt, TripleBolt, SpeedBoost, Invincibility, Overdrive, LeaderHunter }
    public enum PackBand { Front, Middle, Last }

    [Serializable]
    public sealed class ItemWeight
    {
        public ItemKind item;
        [Min(0)] public int weight;
        public ItemWeight(ItemKind item, int weight) { this.item = item; this.weight = weight; }
    }

    [CreateAssetMenu(menuName = "Unlike Hero/Karts/Item Table")]
    public sealed class ItemTable : ScriptableObject
    {
        public List<ItemWeight> front = new List<ItemWeight>
        { new ItemWeight(ItemKind.Trap, 45), new ItemWeight(ItemKind.Bolt, 35), new ItemWeight(ItemKind.Coin, 20) };
        public List<ItemWeight> middle = new List<ItemWeight>
        { new ItemWeight(ItemKind.HomingBolt, 35), new ItemWeight(ItemKind.TripleBolt, 30), new ItemWeight(ItemKind.SpeedBoost, 35) };
        public List<ItemWeight> last = new List<ItemWeight>
        { new ItemWeight(ItemKind.Invincibility, 30), new ItemWeight(ItemKind.Overdrive, 40), new ItemWeight(ItemKind.LeaderHunter, 30) };

        public static PackBand Classify(int placement, int count)
        {
            if (count < 1 || placement < 1 || placement > count) throw new ArgumentOutOfRangeException(nameof(placement));
            // Last takes precedence in a two-racer match. A solo racer gets the front table.
            return count > 1 && placement == count ? PackBand.Last : placement <= 2 ? PackBand.Front : PackBand.Middle;
        }

        public ItemKind Roll(int placement, int count, System.Random random)
        {
            if (random == null) throw new ArgumentNullException(nameof(random));
            PackBand band = Classify(placement, count);
            var rows = band == PackBand.Front ? front : band == PackBand.Last ? last : middle;
            long total = 0;
            if (rows != null) foreach (var row in rows)
                if (row != null && Enum.IsDefined(typeof(ItemKind), row.item)) total += Mathf.Max(0, row.weight);
            if (total == 0) return ItemKind.Coin; // Safe, usable fallback for an empty designer table.
            double ticket = random.NextDouble() * total;
            foreach (var row in rows)
            {
                if (row == null || !Enum.IsDefined(typeof(ItemKind), row.item)) continue;
                ticket -= Mathf.Max(0, row.weight);
                if (ticket < 0) return row.item;
            }
            return ItemKind.Coin;
        }
    }
}
