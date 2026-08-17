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
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: Platform.OS === "web" && showDesktopNav ? 1240 : 768,
        alignSelf: "center",
      }}
    >
      {showDesktopNav ? <DesktopAppNav /> : null}
      {children}
    </View>
  );
}
