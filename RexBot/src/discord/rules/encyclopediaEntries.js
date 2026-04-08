import { createEncyclopediaEntry } from "./Encyclopedia.js";

export const NEW_PLAYER_GUIDE = createEncyclopediaEntry({
  key: "new_player_guide",
  channelId: "1469392438345859112",
  title: "🌟 New Player Guide",
     toc: {
    tocImageFile: "assets/encyclopedia.png",
    description: [
      "Welcome to **Blood & Bone**! This guide helps new players get started.",
      "",
      "**What you'll find here**",
      "• Getting started basics",
      "• Diet/Food information",
      "• 'How to' guides",
      "",
      "*New ones will be added/updated as we grow*",
      "*Need help? Create a ticket at → <#1467572329444938024>*",
      "",
      "Scroll down to begin ⬇️",
    ].join("\n"),
  },
  imageFiles: [
    "assets/Map.png",
    "assets/helper.png",
    "assets/Compassmeanings.png",
    "assets/Staminasystem.png",
    "assets/beginnnerfriendlydino.png",
    "assets/debuggmutation.png",
    "assets/AvailableNutrients.png",
    "assets/Dietcombo.png",
    "assets/Organs.png",
    "assets/Prime.png",
    "assets/gettingorgans.png",
    "assets/Logout.png",
  ],
});
