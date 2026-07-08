import { Platform, View } from "react-native";
import type { ReactNode } from "react";
import DesktopAppNav from "./DesktopAppNav";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  showDesktopNav?: boolean;
}

export function PageContainer({
  children,
  className = "",
  showDesktopNav = false,
}: PageContainerProps) {
  return (
    <View
      className={`w-full self-center ${className}`}
      style={{ maxWidth: Platform.OS === "web" && showDesktopNav ? 1180 : 768 }}
    >
      {showDesktopNav ? <DesktopAppNav /> : null}
      {children}
    </View>
  );
}
