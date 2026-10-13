const AVATAR_BASE = 'assets/images/avatars/naruto/optimized/';

export const SHINOBI_AVATARS = [
  ['itachi-uchiha-portrait-01.webp', 'Itachi Uchiha · Portrait I'],
  ['itachi-uchiha-akatsuki-01.webp', 'Itachi Uchiha · Akatsuki I'],
  ['sasuke-uchiha-rinnegan.webp', 'Sasuke Uchiha · Rinnegan'],
  ['konan-akatsuki-portrait.webp', 'Konan · Akatsuki'],
  ['itachi-uchiha-portrait-02.webp', 'Itachi Uchiha · Portrait II'],
  ['sasuke-uchiha-monochrome.webp', 'Sasuke Uchiha · Monochrome'],
  ['itachi-uchiha-akatsuki-02.webp', 'Itachi Uchiha · Akatsuki II'],
  ['itachi-uchiha-shadow-eye.webp', 'Itachi Uchiha · Shadow Eye'],
  ['shinobi-silhouette.webp', 'Shinobi · Silhouette'],
  ['pain-akatsuki-portrait-01.webp', 'Pain · Akatsuki I'],
  ['pain-akatsuki-portrait-02.webp', 'Pain · Akatsuki II'],
  ['naruto-uzumaki-portrait-01.webp', 'Naruto Uzumaki · Portrait'],
  ['obito-uchiha-akatsuki.webp', 'Obito Uchiha · Akatsuki'],
  ['itachi-uchiha-edo-tensei.webp', 'Itachi Uchiha · Edo Tensei'],
  ['itachi-and-sasuke.webp', 'Itachi & Sasuke Uchiha'],
  ['itachi-uchiha-akatsuki-03.webp', 'Itachi Uchiha · Akatsuki III'],
  ['itachi-uchiha-susanoo.webp', 'Itachi Uchiha · Susanoo'],
  ['itachi-uchiha-chakra-art.webp', 'Itachi Uchiha · Chakra Art'],
  ['itachi-uchiha-moon-silhouette.webp', 'Itachi Uchiha · Moonlight'],
  ['uchiha-sharingan-portrait.webp', 'Uchiha · Sharingan Portrait'],
  ['itachi-uchiha-silent-protector.webp', 'Itachi Uchiha · Silent Protector'],
  ['kakashi-hatake-anbu.webp', 'Kakashi Hatake · ANBU'],
  ['kakashi-hatake-lightning.webp', 'Kakashi Hatake · Lightning'],
  ['kakashi-hatake-dark-sharingan.webp', 'Kakashi Hatake · Sharingan'],
  ['kakashi-hatake-action.webp', 'Kakashi Hatake · Battle'],
  ['kakashi-hatake-red-cloak.webp', 'Kakashi Hatake · Red Cloak'],
  ['madara-uchiha-portrait.webp', 'Madara Uchiha'],
  ['mangekyo-sharingan-mark-01.webp', 'Mangekyō Sharingan · Mark I'],
  ['mangekyo-sharingan-mark-02.webp', 'Mangekyō Sharingan · Mark II'],
  ['obito-uchiha-tobi-mask.webp', 'Obito Uchiha · Tobi Mask'],
  ['hashirama-senju.webp', 'Hashirama Senju'],
  ['naruto-uzumaki-hand-sign.webp', 'Naruto Uzumaki · Hand Sign'],
  ['minato-hokage-village.webp', 'Minato Namikaze · Hokage'],
  ['sharingan-symbol.webp', 'Sharingan'],
  ['jiraiya-sannin.webp', 'Jiraiya · Sannin'],
  ['pain-yahiko-portrait.webp', 'Yahiko · Pain'],
].map(([filename, label]) => ({
  filename,
  label,
  src: `${AVATAR_BASE}${filename}`,
}));

export function parseShinobiAvatar(value) {
  if (typeof value !== 'string') return null;
  const match = /^konoha-avatar:v1:([a-z0-9-]+\.webp)\|(\d+(?:\.\d{1,2})?)\|(\d{1,3})\|(\d{1,3})$/.exec(value);
  if (!match) return null;
  const avatar = SHINOBI_AVATARS.find(item => item.filename === match[1]);
  const zoom = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  if (!avatar || zoom < 1 || zoom > 2.5 || x > 100 || y > 100) return null;
  return { ...avatar, zoom, x, y };
}
