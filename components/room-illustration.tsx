"use client"

import { useId } from "react"

function Plant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 0c-10-60-12-106-5-153M0-37c25-35 35-65 30-91M-2-65c-26-20-39-45-35-72"
        stroke="#557652"
        strokeWidth="6"
      />
      <path
        d="M-6-100c-65-15-75-50-56-56 32-10 52 20 56 56m4-32c-35-47-14-75 0-70 20 8 19 49 0 70m10 40c51-39 79-25 63-6-14 18-40 24-63 6m-1 48c40-20 58-9 48 8-9 14-35 15-48-8"
        fill="#78986a"
      />
      <path d="M-27-5h54L18 46h-36z" fill="#c4ac87" />
      <ellipse cy="-5" rx="27" ry="7" fill="#98805e" />
    </g>
  )
}

export function RoomIllustration() {
  const id = useId().replace(/:/g, "")
  return (
    <svg className="room-illustration" viewBox="0 0 900 640" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor="#c4dbd1" />
          <stop offset="1" stopColor="#eff1db" />
        </linearGradient>
        <linearGradient id={`${id}-arch`} x2="1" y2="1">
          <stop stopColor="#cab99a" />
          <stop offset="1" stopColor="#e8dcc1" />
        </linearGradient>
      </defs>
      <g className="room-layer room-layer-sport">
        <path d="M0 0h900v640H0z" fill="#dae5d4" />
        <path d="M0 422 900 390v250H0z" fill="#a8c29c" />
        <path d="M0 425 900 393" stroke="#97b48c" strokeWidth="3" />
        <rect x="490" y="55" width="350" height="310" rx="4" fill={`url(#${id}-sky)`} />
        <path d="M580 55v310m85-310v310m85-310v310M490 182h350" stroke="#a7bca4" strokeWidth="7" />
        <path d="m520 365 127-235h120L651 365" fill="#edf1db" opacity=".5" />
        <path d="m-60 545 360-80 285 99-370 101z" fill="#367f5b" />
        <path d="m-14 545 314-68 240 84-325 87zM299 477l-84 171m-76-138 244 84" stroke="#d7e5bb" strokeWidth="3" />
        <ellipse cx="267" cy="557" rx="53" ry="24" transform="rotate(10 267 557)" stroke="#d7e5bb" strokeWidth="3" />
        <rect x="76" y="118" width="168" height="111" rx="7" fill="#f1f0d9" stroke="#b6c6a6" strokeWidth="5" />
        <rect x="118" y="158" width="73" height="43" rx="3" stroke="#a7bb96" strokeWidth="3" />
        <path d="M147 210h54m-49 1 6 28h32l6-28" stroke="#b77d50" strokeWidth="5" />
        <path d="M87 372h232v21H87z" fill="#65875d" />
        <path d="M104 390v63m196-63v45" stroke="#59794f" strokeWidth="12" />
        <path d="M114 349h172" stroke="#244e38" strokeWidth="5" />
        {[139, 198, 255].map((x, i) => (
          <g key={x}>
            <rect x={x} y={335 - i * 2} width="13" height="30" rx="4" fill="#416044" />
            <rect x={x - 8} y={339 - i * 2} width="29" height="23" rx="4" fill="#416044" />
          </g>
        ))}
        <text x="77" y="71" fill="#63865c" fontFamily="Arial,sans-serif" fontSize="13" letterSpacing="3">
          MOVE. REFRESH. REPEAT.
        </text>
        <Plant x={805} y={435} scale={0.72} />
      </g>
      <g className="room-layer room-layer-office">
        <path d="M0 0h900v640H0z" fill="#e3e4d7" />
        <path d="M0 422 900 390v250H0z" fill="#c4ccbc" />
        <path d="M0 425 900 393" stroke="#acb9a4" strokeWidth="3" />
        <rect x="75" y="70" width="325" height="270" rx="5" fill={`url(#${id}-sky)`} />
        <path d="M83 300 144 214h41v-77h47v113h55v-43h62v93" fill="#b8c6b7" />
        <path d="M183 70v270m109-270v270M75 214h325" stroke="#f4f0de" strokeWidth="10" />
        <path d="m62 418 271-13 85 39-275 20z" fill="#b4a184" />
        <path d="M91 443v83m272-84v68" stroke="#6e7967" strokeWidth="11" />
        <rect x="179" y="318" width="105" height="73" rx="5" fill="#405f4b" />
        <rect x="186" y="325" width="91" height="56" rx="2" fill="#cad9bf" />
        <path d="M230 390v22m-27 1h56" stroke="#48614b" strokeWidth="6" />
        <path d="M198 342h54m-54 10h35m-35 10h44" stroke="#91af85" strokeWidth="4" />
        <path d="M131 507v63m39-61v57m-47 9h57" stroke="#59745e" strokeWidth="8" />
        <path d="M105 452c0-30 74-30 74 0v52h-74z" fill="#6e8e71" />
        <ellipse cx="142" cy="508" rx="48" ry="12" fill="#59785b" />
        <rect x="669" y="117" width="125" height="139" rx="3" fill="#c8cbb4" />
        <path d="m690 234 43-85 42 85z" fill="#779478" />
        <circle cx="456" cy="121" r="32" fill="#f2efdc" stroke="#b1bea9" strokeWidth="4" />
        <path d="M456 99v22l15 11" stroke="#6d8566" strokeWidth="3" strokeLinecap="round" />
        <Plant x={811} y={441} scale={0.82} />
        <ellipse cx="318" cy="424" rx="18" ry="6" fill="#647c62" />
        <path d="M306 406h24v15c0 8-24 8-24 0z" fill="#f4f0d9" />
      </g>
      <g className="room-layer room-layer-hotel">
        <path d="M0 0h900v640H0z" fill="#e9dfc7" />
        <path d="M0 422 900 390v250H0z" fill="#d1bea0" />
        <path d="M0 425 900 393" stroke="#bfa98a" strokeWidth="3" />
        <path d="M83 363V174a119 119 0 0 1 238 0v189z" fill={`url(#${id}-arch)`} />
        <path d="M105 363V174a97 97 0 0 1 194 0v189" stroke="#f4e9cf" strokeWidth="6" />
        <path d="M202 82v281" stroke="#b3a17f" strokeWidth="4" />
        <rect x="72" y="372" width="263" height="91" rx="25" fill="#a8b296" />
        <rect x="91" y="345" width="101" height="81" rx="21" fill="#b5bda3" />
        <rect x="199" y="345" width="118" height="81" rx="21" fill="#b5bda3" />
        <path d="M94 459v25m220-25v16" stroke="#897e63" strokeWidth="8" />
        <path d="M362 232v204m-31 0h62" stroke="#ac9162" strokeWidth="7" />
        <path d="m331 234 18-72h27l19 72z" fill="#efe9ce" />
        <ellipse cx="364" cy="232" rx="33" ry="6" fill="#c7b890" />
        <path d="m666 379 128-10 61 35-132 13z" fill="#a88b65" />
        <path d="M666 379v87l58 32 131-20v-74l-131 13z" fill="#bd9f77" />
        <path d="M724 417v81" stroke="#a58b64" strokeWidth="2" />
        <path
          d="M688 438v-29m13 37v-29m13 34v-29m25 48v-36m13 34v-36m13 34v-36m13 34v-36m13 34v-36"
          stroke="#d5be98"
          strokeWidth="3"
        />
        <circle cx="720" cy="333" r="17" fill="#c8ad77" />
        <path d="M720 350v18m-16 0h32" stroke="#ae8f56" strokeWidth="3" />
        <text x="699" y="161" fill="#a48d66" fontFamily="Georgia,serif" fontSize="31" letterSpacing="5">
          WELCOME
        </text>
        <Plant x={61} y={422} scale={0.65} />
      </g>
      <ellipse cx="544" cy="545" rx="142" ry="21" fill="#27432e" opacity=".12" />
    </svg>
  )
}
