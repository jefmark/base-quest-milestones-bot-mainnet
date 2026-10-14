# نسخه ۱.۱.۰ مین‌نت — فقط مرورگر، GitHub، Remix و MetaMask

این بسته جایگزین نسخه ناقص مخزن است. به کلید خصوصی، seed، فایل .env، نصب Node یا ترمینال روی کامپیوتر خودت نیاز نداری. تست و بیلد را GitHub Actions انجام می‌دهد. قرارداد و قواعد بازی ثابت مانده‌اند و چندامضایی/پراکسی ندارند. نسخه Upgradeable تغییر نکرده است.

## ۱. آپلود کامل

ZIP را روی کامپیوتر استخراج کن. وارد پوشه پروژه شو؛ محتویات آن را در ریشه یک مخزن عمومی جدید یا مخزنی که فایل‌های قدیمی آن با آگاهی پاک شده‌اند آپلود کن. لازم نیست ریپوی قبلی را حذف کنی. ZIP را خودش آپلود نکن؛ GitHub آن را به پروژه تبدیل نمی‌کند.

این نسخه کمتر از ۱۰۰ فایل دارد؛ هر فایل زیر سقف ۲۵ مگابایت آپلود مرورگر است. فایل‌های گزارش قدیمی و اسکریپت‌های دیپلوی با کلید خصوصی حذف شده‌اند. فهرست دقیق فایل‌ها در UPLOAD-FILES.json است. روی صفحه اول مخزن باید package.json، site-settings.json، index.html و پوشه‌های src، scripts، public، contracts، remix و .github دیده شوند.

اگر سیستم‌عامل پوشه .github را پنهان می‌کند، آن را نمایش بده یا سه فایل workflow را با Add file → Create new file در مسیرهای دقیق زیر بساز و متن فایل متناظر داخل ZIP را کپی کن:
.github/workflows/ci.yml
.github/workflows/deploy-pages.yml
.github/workflows/security.yml

نکته: ترتیب پوشه‌ها مهم است. public/nft باید داخل public باشد، نه ریشه مخزن. package.json نباید داخل یک پوشه اضافی باشد. پیش از انتشار، مرحله Check complete browser upload باید موفق شود؛ در صورت نقص، اسم دقیق فایل‌های جاافتاده را نشان می‌دهد.

## ۲. انتشار اولیه سایت، قبل از قرارداد

ابتدا site-settings.json را همان‌طور نگه دار. network پیش‌فرض botMainnet است و آدرس قرارداد خالی است. بنابراین سایت فقط تمرینی باز می‌شود و نمی‌تواند تراکنش مینت بفرستد.

Settings → Pages → Source را GitHub Actions انتخاب کن. سپس Actions → Deploy Base Quest to GitHub Pages → Run workflow را بزن. روی push دیگر اجرای انتشار شکست‌خورده غیرضروری ایجاد نمی‌شود؛ فقط تست CI اجرا می‌شود. انتشار سایت دستی است.

در این نسخه نیازی به ساخت Variableهای قدیمی VITE_* نداری. تنظیمات عمومی از site-settings.json خوانده می‌شوند. workflow جدید Variableهای قبلی مخزن را به محیط منتقل نمی‌کند. آدرس سایت در Actions از نام مخزن خودکار ساخته می‌شود؛ اگر دامنه اختصاصی نداری publicAppUrl را خالی بگذار.

اگر همین نام را انتخاب کنی، آدرس سایت:
https://jefmark.github.io/base-quest-milestones-bot-mainnet/

سایت و آدرس‌های metadata/1.json و nft/1.png را باز کن. نمایش سایت پیش از دیپلوی طبیعی است؛ مینت تا ثبت آدرس واقعی فعال نیست. برای Reown فقط walletConnectProjectId را در JSON پر کن و انتشار را دوباره اجرا کن. نبود این شناسه اتصال QR را غیرفعال می‌کند؛ نباید کل سایت سفید شود. Allowlist پروژه Reown را برای https://jefmark.github.io تنظیم کن.

## ۳. استقرار با Remix و MetaMask

به https://remix.ethereum.org برو. فقط remix/BaseQuestMilestones.sol را بارگذاری کن. این فایل تمام وابستگی‌های OpenZeppelin 5.0.2 را همراه دارد و هیچ import شبکه‌ای ندارد.

در Solidity Compiler:
- compiler: 0.8.24
- Enable optimization: فعال
- runs: 200
- EVM version: paris
- viaIR: غیرفعال
سپس Compile کن. در Deploy & Run قرارداد BaseQuestMilestones را انتخاب کن، نه قراردادهای کتابخانه‌ای همراه فایل.

Environment: Browser Extension / MetaMask؛ در بعضی رابط‌ها Injected Provider نام دارد. حساب و شبکه را در پنجره کیف پول کنترل کن. ابتدا همین قرارداد ثابت را روی BOT testnet با chain ID 968 امتحان کن؛ برای استقرار نهایی شبکه BOT mainnet با chain ID 677 را انتخاب کن. این پروژه شبکه Coinbase Base نیست.

پارامترهای رسمی شبکه:
تست‌نت RPC https://rpc.bohr.life ، اکسپلورر https://scan.bohr.life ، گس BOT آزمایشی.
مین‌نت RPC https://rpc.botchain.ai ، اکسپلورر https://scan.botchain.ai ، گس BOT.

سه ورودی constructor:
۱. initialOwner: آدرس عمومی مالک. می‌تواند همان کیف پول دیپلوی باشد.
۲. initialBaseURI: نشانی سایت منتشرشده، با /metadata/ در انتها؛ مثال:
https://jefmark.github.io/base-quest-milestones-bot-mainnet/metadata/
۳. initialTreasury: آدرس عمومی خزانه؛ می‌تواند همان مالک باشد. این نسخه هزینه مینت پروژه دریافت نمی‌کند.

Value را صفر نگه دار. Deploy را بزن و هزینه شبکه را در خود MetaMask بررسی و تأیید کن. seed یا private key را هیچ‌جا کپی نمی‌کنی. آدرس قرارداد و هش تراکنش را ذخیره کن. به initialize، پراکسی یا Safe نیازی نیست.

خواندن‌های بعد از استقرار:
owner باید آدرس انتخابی تو باشد؛ deploymentKind برابر BASEQUEST_FIXED_V1؛ MAX_MILESTONE برابر 12؛ totalMinted در شروع صفر؛ feeEnabled برابر false؛ mintCooldown برابر 40؛ مرحله ۱ امتیاز 1200 و مرحله ۱۲ امتیاز 60000.

## ۴. اتصال سایت به قرارداد

در GitHub فقط site-settings.json را ویرایش کن.
برای تست‌نت: network را botTestnet و testnetContractAddress را آدرس قرارداد مستقیم تست‌نت بگذار.
برای مین‌نت: network را botMainnet و mainnetContractAddress را آدرس قرارداد مستقیم مین‌نت بگذار.
آدرس‌ها باید با 0x شروع شوند و ۴۰ رقم هگز داشته باشند. آدرس کیف پول یا implementation پراکسی را به جای قرارداد ثابت وارد نکن.

walletConnectProjectId شناسه عمومی Reown خودت است و بعداً قابل تعویض است. publicAppUrl برای GitHub Pages معمولی خالی می‌ماند. JSON باید معتبر بماند؛ بعد از آخرین مقدار ویرگول اضافی نگذار.

Commit changes سپس Actions → Deploy Base Quest to GitHub Pages → Run workflow. پس از سبزشدن deploy صفحه را با تازه‌سازی کامل باز کن. هر تغییر این JSON به بیلد و انتشار تازه نیاز دارد. شبکه و قرارداد قبلی خودکار به شبکه دیگر منتقل نمی‌شوند.

## ۵. آزمون واقعی قبل از اعلام عمومی

با یک کیف پول اتصال، شروع دور، ردکردن یک درخواست و تلاش مجدد، مینت مرحله ۱، ادامه تا مرحله ۲، رفرش، تغییر حساب و قطع/وصل را امتحان کن. آدرس و chain تراکنش‌ها را در اکسپلورر کنترل کن. tokenURI(1) باید JSON مرحله ۱ را نشان دهد و image داخل JSON باید عمومی و قابل بازشدن باشد.

برای Verify سورس در اکسپلورر، همین فایل standalone و دقیقاً تنظیمات 0.8.24 / 200 / paris و سه ورودی constructor را نگه دار. پشتیبانی اکسپلورر از Verify باید در عمل بررسی شود. این بسته هیچ دیپلوی یا تراکنش واقعی از طرف تو انجام نداده است.

## علت خطاهای بررسی‌شده و محدودیت‌ها

لاگ ارسالی صریحاً نبود scripts/deploy-network.cjs را نشان می‌داد. این نسخه دیگر آن فایل یا مسیر دیپلوی با کلید خصوصی را لازم ندارد؛ validator نیز به آن ارجاع نمی‌دهد. محدودیت ۱۰۰ فایل در آپلود مرورگر می‌تواند باعث آپلود ناقص بسته قبلی شود؛ نمی‌توان از همین لاگ به‌تنهایی اثبات کرد که تمام فایل‌های قبلی چرا جا افتاده‌اند.

در نسخه قبلی، نبود آدرس/تأیید مین‌نت می‌توانست هنگام import تنظیمات خطا بدهد و صفحه خالی بماند. اکنون نبود آدرس حالت تمرینی دارد، تنظیمات هنگام بیلد بررسی می‌شوند و خطای آغاز برنامه به‌جای صفحه سفید نشان داده می‌شود. لاگ Actions علت دقیق خطای مرورگر قبلی را ثابت نمی‌کند؛ کنسول همان انتشار در دسترس نبود.

قرارداد ثابت به معنی ثابت‌بودن تمام تنظیمات نیست؛ مالک می‌تواند pause، URI و تنظیمات مجاز را مدیریت کند. امتیاز مرورگر همچنان قابل‌جعل است؛ این اصلاح ضدتقلب رمزنگاری‌شده اضافه نمی‌کند. بازیکن فقط یک کیف پول لازم دارد اما تراکنش‌های شروع/مینت گس و تأیید عادی همان کیف پول را می‌خواهند.

منابع رسمی:
https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
https://remix-ide.readthedocs.io/en/latest/run.html
https://dev-docs.botchain.ai/docs/Developers/quick-guide/
