import type { SVGProps } from "react"

export type ProductKind = "coffee" | "water" | "snack"

export function ProductGlyph({ kind, ...props }: SVGProps<SVGSVGElement> & { kind: ProductKind }) {
  return (
    <svg viewBox="0 0 100 120" fill="none" aria-hidden="true" focusable="false" {...props}>
      {kind === "water" && (
        <>
          <path d="M37 17h26v20l12 17v47c0 10-50 10-50 0V54l12-17z" fill="#a4d4cb" stroke="#d5ede2" strokeWidth="2" />
          <path d="M33 60h34v32H33z" fill="#f0f3db" />
          <path d="m41 73 9-12 9 12c7 12-25 12-18 0" fill="#417d69" />
          <rect x="36" y="10" width="28" height="13" rx="4" fill="#e7edca" />
          <path d="M32 48v47" stroke="white" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" />
          <path d="M42 88h17" stroke="#689c84" strokeWidth="2" />
          <ellipse cx="50" cy="103" rx="21" ry="4" fill="#6cae9c" opacity=".4" />
        </>
      )}
      {kind === "coffee" && (
        <>
          <path
            d="M38 11c-12 11 12 13 0 24m15-29c-12 11 12 13 0 24"
            stroke="#d9e4c5"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="49" cy="99" rx="41" ry="9" fill="#b5c9a8" />
          <ellipse cx="49" cy="95" rx="35" ry="7" fill="#f5f2d9" />
          <path d="M73 49h8c22 0 19 30-7 30" stroke="#f8f4dc" strokeWidth="10" />
          <path d="M18 44h61l-6 37c-3 17-43 17-48 0z" fill="#f7f2dc" />
          <ellipse cx="49" cy="45" rx="31" ry="9" fill="#dfd8b8" />
          <ellipse cx="49" cy="45" rx="26" ry="6" fill="#76482b" />
          <ellipse cx="48" cy="43" rx="19" ry="3" fill="#b78549" />
          <path d="M27 56v17" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <text
            x="48"
            y="77"
            textAnchor="middle"
            fill="#2f6a50"
            fontSize="16"
            fontFamily="Arial,sans-serif"
            fontWeight="700"
            letterSpacing="-1"
          >
            lify.
          </text>
        </>
      )}
      {kind === "snack" && (
        <>
          <path d="m23 11 54 3-4 25 5 66-57 2 5-68z" fill="#daa16d" stroke="#edc294" strokeWidth="2" />
          <path d="m26 19 48 2m-48 77 49-1" stroke="#aa7349" strokeWidth="3" />
          <rect x="29" y="34" width="43" height="48" rx="17" fill="#efe5bd" />
          <ellipse cx="43" cy="54" rx="6" ry="9" transform="rotate(30 43 54)" fill="#a57945" />
          <ellipse cx="58" cy="60" rx="6" ry="9" transform="rotate(-25 58 60)" fill="#799156" />
          <path d="M36 73h28" stroke="#b3ac79" strokeWidth="2" />
          <path d="M29 27v53" stroke="#ffddaa" strokeWidth="3" strokeLinecap="round" opacity=".5" />
        </>
      )}
    </svg>
  )
}
