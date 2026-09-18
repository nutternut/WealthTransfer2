type MemberAvatarProps = {
  seed: string;
  name: string;
  size?: number;
  className?: string;
};

const BACKGROUNDS = [
  "b6e3f4",
  "c0aede",
  "d1f4d7",
  "ffd5dc",
  "ffdfbf",
  "c7f0e2",
  "fde68a",
  "a5f3fc",
];

function hashSeed(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** คาดเดาเพศจากคำนำหน้าไทย เพื่อให้ใบหน้าการ์ตูนสมเหตุสมผลขึ้น */
function genderHint(name: string): "male" | "female" | undefined {
  if (/^(นางสาว|นาง|เด็กหญิง|คุณหญิง)/.test(name.trim())) return "female";
  if (/^(นาย|เด็กชาย|คุณชาย)/.test(name.trim())) return "male";
  return undefined;
}

export function memberAvatarUrl(seed: string, name: string, size = 96) {
  const params = new URLSearchParams({
    seed,
    size: String(size),
    backgroundColor: BACKGROUNDS[hashSeed(seed) % BACKGROUNDS.length],
  });
  const gender = genderHint(name);
  if (gender) params.set("gender", gender);
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

export function MemberAvatar({
  seed,
  name,
  size = 36,
  className = "",
}: MemberAvatarProps) {
  return (
    <img
      src={memberAvatarUrl(seed, name, Math.max(size * 2, 64))}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
