// Upstream: https://github.com/Bia10/Maple.Client.V95
// Pinned upstream commit: 24bbf0e2cda769e6bcf4791a77b8336dd2cca2aa
// License: MIT (see LICENSE in this directory)

namespace Maple.Client.V95;

public static partial class ClientStructs
{
    public static class Offsets
    {
        public static class CWvsContext
        {
            public const int AccountId = 0x2030;
            public const int Gender = 0x2034;
            public const int GradeCode = 0x2038;
            public const int SubGradeCode = 0x2044;
            public const int EmailAccount = 0x2050;
            public const int NexonClubId = 0x2054;
            public const int CountryId = 0x2058;
            public const int PurchaseExp = 0x2059;
            public const int WorldId = 0x205C;
            public const int ChannelId = 0x2060;
            public const int CharacterCount = 0x20A0;
            public const int SlotCount = 0x20A4;
            public const int ClientKey = 0x20A8;
            public const int CharacterId = 0x20B4;
            public const int Guild = 0x37C8;
            public const int DirectionMode = 0x3850;
            public const int StandAloneMode = 0x3854;
            public const int ShowUi = 0x3F28;
            public const int ChannelName = 0x3F74;
            public const int AdultChannel = 0x3F78;
            public const int ScreenWidth = 0x41B8;
            public const int ScreenHeight = 0x41BC;
        }

        public static class CLogin
        {
            public const int ConnectionDlg = 0x148;
            public const int CountCharacters = 0x160;
            public const int LoginStep = 0x1A4;
            public const int StepChanging = 0x1A8;
            public const int RequestSent = 0x1AC;
            public const int LoginOpt = 0x1B0;
            public const int SlotCount = 0x1B8;
            public const int WorldItem = 0x1CC;
            public const int CharSelected = 0x1D0;
            public const int LatestConnectedWorldId = 0x234;
            public const int CurSelectedRace = 0x240;
            public const int CurSelectedSubJob = 0x244;
        }

        public static class CUIChannelSelect
        {
            public const int Login = 0xF4;
            public const int UserPopulation = 0xF8;
            public const int Select = 0xFC;
            public const int WorldItem = 0x100;
            public const int ConnectionDlg = 0x128;
        }

        public static class CUIWorldSelect
        {
            public const int Login = 0x94;
            public const int World = 0x98;
            public const int WorldIdx = 0x1D4;
        }

        public static class CQuestMan
        {
            public const int WorldId = 0x64;
        }

        public static class WorldItem
        {
            public const int Stride = 0x20;
            public const int Id = 0x00;
            public const int NamePtr = 0x04;
            public const int ChannelItemsPtr = 0x1C;
        }

        public static class ChannelItem
        {
            public const int Stride = 0x14;
            public const int NamePtr = 0x00;
            public const int WorldId = 0x08;
            public const int ChannelId = 0x0C;
            public const int AdultFlag = 0x10;
        }

        public static class CWvsApp
        {
            public const int HWnd = 0x04;
            public const int MainThreadId = 0x0C;
            public const int AutoConnect = 0x3C;
            public const int TargetVersion = 0x54;
            public const int EnabledDx9 = 0x78;
            public const int WindowActive = 0x88;
        }
    }
}
