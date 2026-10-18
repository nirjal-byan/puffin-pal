export function WorkspaceIllustration() {
  return (
    <svg
      className="workspace-illustration"
      viewBox="0 0 440 370"
      role="img"
      aria-labelledby="workspace-illustration-title"
    >
      <title id="workspace-illustration-title">
        Invoices, expenses, retainers, and team access connected in one workspace
      </title>
      <defs>
        <linearGradient id="paper" x2="0.6" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#eaf3ff" />
        </linearGradient>
        <linearGradient id="tile" x2="1" y2="1">
          <stop stopColor="#45baff" />
          <stop offset="1" stopColor="#0754d6" />
        </linearGradient>
        <linearGradient id="glass" x2="1" y2="1">
          <stop stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity=".07" />
        </linearGradient>
        <filter id="illustration-shadow" x="-50%" y="-50%" width="200%" height="220%">
          <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#002b80" floodOpacity=".28" />
        </filter>
      </defs>
      <circle
        cx="220"
        cy="183"
        r="147"
        fill="#fff"
        fillOpacity=".04"
        stroke="#fff"
        strokeOpacity=".16"
      />
      <circle
        cx="220"
        cy="183"
        r="112"
        fill="none"
        stroke="#fff"
        strokeOpacity=".12"
        strokeDasharray="3 9"
      />
      <g fill="none" stroke="#b7ddff" strokeWidth="1.5" strokeDasharray="4 6" opacity=".65">
        <path d="M83 97H113Q128 97 128 117V152" />
        <path d="M325 106H347V156" />
        <path d="M102 275H128V240" />
        <path d="M308 239H347V279" />
      </g>
      <g transform="translate(130 66) rotate(-7 95 122)" filter="url(#illustration-shadow)">
        <rect x="8" y="10" width="190" height="245" rx="20" fill="#bcd8ff" opacity=".4" />
        <rect width="190" height="245" rx="20" fill="url(#paper)" stroke="#fff" />
        <rect x="20" y="22" width="35" height="35" rx="11" fill="url(#tile)" />
        <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <path d="M31 32h13M31 38h13M31 44h8" />
        </g>
        <text x="66" y="38" fill="#15345c" fontSize="13" fontWeight="650">
          Invoices
        </text>
        <text x="66" y="53" fill="#7994b5" fontSize="9">
          Everything in order
        </text>
        <path d="M20 73H170" stroke="#d8e7f9" />
        <rect x="20" y="90" width="97" height="7" rx="3.5" fill="#b5cdec" />
        <rect x="20" y="106" width="63" height="5" rx="2.5" fill="#d1e1f5" />
        <rect x="20" y="134" width="150" height="45" rx="10" fill="#e1edfc" />
        <path d="M33 150H105M33 163H79" stroke="#a8c6eb" strokeWidth="5" strokeLinecap="round" />
        <circle cx="150" cy="157" r="10" fill="#0754d6" />
        <path
          d="m146 157 3 3 5-6"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M20 199H170" stroke="#d8e7f9" />
        <text x="20" y="224" fill="#6883a5" fontSize="9">
          Workspace currency
        </text>
        <text x="170" y="224" textAnchor="end" fill="#0754d6" fontSize="11" fontWeight="650">
          USD
        </text>
      </g>
      <g filter="url(#illustration-shadow)">
        <rect
          x="22"
          y="65"
          width="94"
          height="72"
          rx="16"
          fill="url(#glass)"
          stroke="#baddff"
          strokeOpacity=".5"
        />
        <g fill="none" stroke="#e2f3ff" strokeWidth="2" strokeLinecap="round">
          <path d="m54 95 8-8 7 5 13-13M75 79h7v7" />
        </g>
        <text x="69" y="121" textAnchor="middle" fill="#fff" fontSize="10">
          Expenses
        </text>
        <rect
          x="315"
          y="126"
          width="103"
          height="72"
          rx="16"
          fill="url(#glass)"
          stroke="#baddff"
          strokeOpacity=".5"
        />
        <g fill="none" stroke="#e2f3ff" strokeWidth="2" strokeLinecap="round">
          <path d="M355 151a11 11 0 0 1 19-2l3 4M377 143v10h-10M377 163a11 11 0 0 1-19 2l-3-4M355 171v-10h10" />
        </g>
        <text x="367" y="185" textAnchor="middle" fill="#fff" fontSize="10">
          Retainers
        </text>
        <rect x="27" y="245" width="116" height="56" rx="15" fill="#fff" />
        <circle cx="51" cy="266" r="6" fill="#84b8ff" />
        <path d="M41 284v-3a10 10 0 0 1 20 0v3" fill="#c9e1ff" />
        <text x="75" y="269" fill="#15345c" fontSize="10" fontWeight="600">
          Your team
        </text>
        <text x="75" y="284" fill="#7994b5" fontSize="8">
          Connected
        </text>
        <rect x="256" y="280" width="151" height="43" rx="13" fill="#fff" />
        <circle cx="278" cy="301" r="10" fill="#e6f7f1" />
        <path
          d="m274 301 3 3 5-6"
          fill="none"
          stroke="#1c9b75"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <text x="296" y="305" fill="#15345c" fontSize="10" fontWeight="550">
          The right access
        </text>
      </g>
      <g fill="#c6e7ff">
        <circle cx="309" cy="46" r="4" />
        <circle cx="52" cy="192" r="3" />
        <circle cx="200" cy="338" r="3" />
        <path d="M365 61v12m-6-6h12" stroke="#c6e7ff" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
