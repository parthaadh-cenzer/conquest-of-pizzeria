export function Avatar({ avatar, name, color, size = 44 }: { avatar: string; name: string; color: string; size?: number }) {
  const index = Number(avatar.split(':')[1]) || 0;
  return <span className="avatar" style={{ width: size, height: size, background: color + '28', borderColor: color }}>
    {avatar.startsWith('data:image/') ? <img src={avatar} alt={`${name}'s avatar`} /> : <svg viewBox="0 0 64 64" role="img" aria-label={`${name}'s avatar`}>
      <circle cx="32" cy="34" r="22" fill={color}/><path d={index % 2 ? 'M12 27 18 7l13 14M34 21 48 7l7 23' : 'M10 30Q0 5 20 14M44 14Q64 5 54 31'} fill={color}/>
      <ellipse cx="32" cy="42" rx="15" ry="12" fill="#f2e9cf"/><ellipse cx="24" cy="31" rx="2.1" ry="3" fill="#293e36"/><ellipse cx="40" cy="31" rx="2.1" ry="3" fill="#293e36"/><path d="m28 39 4 4 4-4" fill="#293e36"/><path d="M32 43v4m-5 0q5 4 10 0" stroke="#293e36" strokeWidth="1.6" fill="none"/>
      {index > 3 && <path d="M13 23h38L35 9Z" fill="#3f5143"/>}
    </svg>}
  </span>;
}
