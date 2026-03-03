import React from "react";
import type { AvatarProps } from "antd";
import { Avatar as AntdAvatar } from "antd";
import { getNameInitials, getRandomColorFromString } from "@/utilities";

type Props = AvatarProps & {
    name?: string;
    photoUrl?: string | null;
};

const CustomAvatarComponent = ({
    name = "",
    photoUrl,
    src,
    style,
    ...rest
}: Props) => {
    // Priority:
    // 1. photoUrl (from Firestore/Auth)
    // 2. src (manual override)
    // 3. initials fallback
    const imageSrc = photoUrl || src || undefined;

    return (
        <AntdAvatar
            {...rest}
            src={imageSrc}
            alt={name}
            size={rest.size || "small"}
            style={{
                backgroundColor: imageSrc
                    ? "transparent"
                    : getRandomColorFromString(name),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                ...style,
            }}
        >
            {!imageSrc && getNameInitials(name)}
        </AntdAvatar>
    );
};

export const CustomAvatar = React.memo(
    CustomAvatarComponent,
    (prev, next) =>
        prev.name === next.name &&
        prev.photoUrl === next.photoUrl &&
        prev.src === next.src
);

