// Upstream: https://github.com/Bia10/Maple.Client.V95
// Pinned upstream commit: 24bbf0e2cda769e6bcf4791a77b8336dd2cca2aa
// License: MIT (see LICENSE in this directory)

namespace Maple.Client.V95;

public static partial class ClientStructs
{
    /// <summary>Static address constants for the GMS v95 client.</summary>
    public static class Addresses
    {
        public const uint CUniqueModelessSingletonPtr = 0x00C64060;
        public const uint CClientSocketSingletonPtr = 0x00C64064;
        public const uint CWvsContextSingletonPtr = 0x00C64068;
        public const uint CWvsAppSingletonPtr = 0x00C64314;
        public const uint CUITitleSingletonPtr = 0x00C6B198;
        public const uint CLicenseDlgSingletonPtr = 0x00C6B19C;
        public const uint CConnectionNoticeDlgSingletonPtr = 0x00C6B1A0;
        public const uint CUIWorldSelectSingletonPtr = 0x00C6B1A4;
        public const uint CUIChannelSelectSingletonPtr = 0x00C6B1A8;
        public const uint CUIRecommendWorldSingletonPtr = 0x00C6B1AC;
        public const uint CUICharSelectSingletonPtr = 0x00C6B1B0;
        public const uint CUICharDetailSingletonPtr = 0x00C6B1B4;
        public const uint CUIAvatarSingletonPtr = 0x00C6B1B8;
        public const uint CUICharDetailVacSingletonPtr = 0x00C6B1BC;
        public const uint CUIAvatarVacSingletonPtr = 0x00C6B1C0;
        public const uint CUINewCharRaceSelectSingletonPtr = 0x00C6B1C4;
        public const uint CUINewCharNameSelectCygnusSingletonPtr = 0x00C6B1C8;
        public const uint CUINewCharNameSelectNormalSingletonPtr = 0x00C6B1CC;
        public const uint CUINewCharNameSelectAranSingletonPtr = 0x00C6B1D0;
        public const uint CUINewCharNameSelectEvanSingletonPtr = 0x00C6B1D4;
        public const uint CUINewCharJobSelectSingletonPtr = 0x00C6B1D8;
        public const uint CUINewCharAvatarSelectSingletonPtr = 0x00C6B1DC;
        public const uint CLoginGradeWndSingletonPtr = 0x00C6B1E0;
        public const uint CUIGetUserInfoSingletonPtr = 0x00C6B1E4;
        public const uint CNmcoClientObjectSingletonPtr = 0x00C6B1E8;
        public const uint CQuestManSingletonPtr = 0x00C6AB68;
        public const uint CClientSocketSendPacketPtr = 0x00C687AC;
        public const uint SendLoginPacketFunc = 0x005DBEF0;
        public const uint SetWorldInfoFunc = 0x009E02A0;
    }
}
