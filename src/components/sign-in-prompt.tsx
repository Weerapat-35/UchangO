import Link from "next/link";

type SignInPromptProps = {
  /** หัวข้อ เช่น "กรุณาเข้าสู่ระบบ" */
  title: string;
  /** อธิบายว่าทำไมต้องเข้าสู่ระบบ */
  message: string;
  /** ใช้ h1 เมื่อกล่องนี้เป็นเนื้อหาหลักของหน้า (หน้านั้นไม่มีหัวข้ออื่น) */
  headingLevel?: 1 | 2;
  /** แสดงลิงก์สมัครสมาชิก (ปิดสำหรับหน้าของพนักงาน) */
  showSignUp?: boolean;
};

/** กล่องชวนเข้าสู่ระบบ ใช้ร่วมกันทุกหน้าลูกค้าที่ต้องล็อกอินก่อนใช้งาน */
export function SignInPrompt({ title, message, headingLevel = 2, showSignUp = true }: SignInPromptProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="sign-in-prompt">
      <span className="sign-in-prompt__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <Heading>{title}</Heading>
      <p>{message}</p>
      <Link href="/auth" className="sign-in-prompt__primary">เข้าสู่ระบบ</Link>
      {showSignUp ? (
        <p className="sign-in-prompt__hint">
          ยังไม่มีบัญชี? <Link href="/auth">สมัครสมาชิกฟรี</Link>
        </p>
      ) : null}
    </div>
  );
}
