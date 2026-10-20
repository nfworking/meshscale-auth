/**
 * A template is created anew on every navigation, unlike a layout, so the page eases in each time instead of switching
 * abruptly between sign-in, sign-up and the other steps. The motion is turned off for people who ask for less of it.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="au-page">{children}</div>;
}
