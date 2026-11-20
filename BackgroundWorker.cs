using Blazor.BrowserExtension;
using WebExtensions.Net.Runtime;

namespace SoundPitchExtension
{
    public partial class BackgroundWorker : BackgroundWorkerBase
    {
        [BackgroundWorkerMain]
        public override void Main()
        {
            WebExtensions.Runtime.OnInstalled.AddListener(OnInstalled);
        }

        // onInstalled also fires when Chrome itself updates (and for shared-module updates);
        // only show the welcome page for a fresh install or a new version of this extension.
        async Task OnInstalled(OnInstalledEventCallbackDetails details)
        {
            if (details?.Reason is not (OnInstalledReason.Install or OnInstalledReason.Update)) return;

            var indexPageUrl = WebExtensions.Runtime.GetURL("index.html");
            await WebExtensions.Tabs.Create(new()
            {
                Url = indexPageUrl
            });
        }
    }
}
