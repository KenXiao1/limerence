use clap::Parser;

mod app;
mod input;
mod ui;

#[derive(Parser)]
#[command(name = "limerence", about = "极简 AI Waifu Agent")]
struct Cli {
    /// 角色卡 JSON 文件路径
    #[arg(short, long)]
    character: Option<String>,

    /// 继续上一个会话
    #[arg(short, long)]
    resume: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    let config = limerence_core::Config::load();

    let character = if let Some(path) = &cli.character {
        limerence_core::CharacterCard::load(std::path::Path::new(path))?
    } else {
        limerence_core::CharacterCard::default_character()
    };

    let mut app = app::App::new(config, character);

    app.run().await?;

    Ok(())
}
