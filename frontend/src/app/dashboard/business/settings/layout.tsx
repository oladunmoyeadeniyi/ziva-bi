"use client";

/**
 * Settings sub-layout — M8.2.
 *
 * The settings sub-navigation has moved to the main business layout sidebar
 * (grouped into COMMON DATA / WORKFLOW & ACCESS / MODULE SETUP).
 * This layout now renders children directly without any additional wrapper.
 */

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
