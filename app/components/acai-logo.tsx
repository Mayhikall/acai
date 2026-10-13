import Image from "next/image";
import logo from "@/app/_assets/acai-logo.png";
import symbol from "@/app/icon.png";
import styles from "./acai-logo.module.css";

export function AcaiLogo({
  symbolOnly = false,
  small = false,
  onLight = false,
}: {
  symbolOnly?: boolean;
  small?: boolean;
  onLight?: boolean;
}) {
  return (
    <span
      className={`${styles.brand} ${onLight && !symbolOnly ? styles.onLight : ""}`}
    >
      <span
        className={`${symbolOnly ? styles.symbol : styles.lockup} ${small ? styles.small : ""}`}
      >
        <Image
          src={symbolOnly ? symbol : logo}
          alt="Acai"
          className={styles.image}
          sizes={symbolOnly ? "48px" : "200px"}
        />
      </span>
    </span>
  );
}
