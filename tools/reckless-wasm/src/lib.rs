#![allow(dead_code, clippy::manual_is_multiple_of, clippy::if_same_then_else)]
#![allow(unsafe_op_in_unsafe_fn)]
#[link(wasm_import_module = "host")]
unsafe extern "C" {
    fn output(ptr: *const u8, len: usize);
}
fn emit(text: &str) {
    unsafe {
        output(text.as_ptr(), text.len());
    }
}
macro_rules! print { ($($arg:tt)*) => { crate::emit(&format!($($arg)*)) }; }
macro_rules! println {
    () => { crate::emit("\n") };
    ($($arg:tt)*) => { crate::emit(&format!("{}\n", format_args!($($arg)*))) };
}
mod board;
mod clock;
mod evaluation;
mod history;
mod lookup;
mod misc;
mod movepick;
mod nnue;
mod numa;
mod parameters;
mod search;
mod stack;
mod thread;
mod time;
mod transposition;
mod types;
use board::{Board, NullBoardObserver};
use std::{
    cell::RefCell,
    sync::{Arc, atomic::Ordering},
};
use thread::{SharedContext, Status, ThreadData};
use time::{Limits, TimeManager};
thread_local! {
    static ENGINE: RefCell<Option<Box<ThreadData>>> = const { RefCell::new(None) };
    static INPUT: RefCell<[u8; 65536]> = const { RefCell::new([0; 65536]) };
}
#[unsafe(no_mangle)]
pub extern "C" fn input_ptr() -> *mut u8 {
    INPUT.with(|input| input.borrow_mut().as_mut_ptr())
}
#[unsafe(no_mangle)]
pub extern "C" fn initialize() {
    lookup::initialize();
    nnue::initialize();
    ENGINE.with(|e| {
        *e.borrow_mut() = Some(Box::new(ThreadData::new(
            Arc::new(SharedContext::default()),
        )))
    });
}
// The owning worker runs searches synchronously. Termination cancels a search,
// without SharedArrayBuffer or cross-origin isolation on the desktop.
#[unsafe(no_mangle)]
pub extern "C" fn command(len: usize) -> u32 {
    if len > 65536 {
        return 0;
    }
    INPUT.with(|input| {
        let input = input.borrow();
        let Ok(text) = std::str::from_utf8(&input[..len]) else {
            return 0;
        };
        ENGINE.with(|engine| {
            let mut engine = engine.borrow_mut();
            let Some(td) = engine.as_mut() else {
                return 0;
            };
            u32::from(run(td, text))
        })
    })
}
fn run(td: &mut ThreadData, command: &str) -> bool {
    let tokens: Vec<_> = command.split_whitespace().collect();
    match tokens.as_slice() {
        ["uci"] => {
            println!("id name Reckless 0.9.0 WASM\nuciok");
        }
        ["isready"] => {
            println!("readyok");
        }
        ["ucinewgame"] => {
            td.shared.tt.clear(1);
        }
        ["setoption", "name", "MultiPV", "value", value] => {
            let Ok(value) = value.parse::<usize>() else {
                return false;
            };
            td.multi_pv = value.clamp(1, 3);
        }
        ["position", args @ ..] => {
            let split = args
                .iter()
                .position(|s| *s == "moves")
                .unwrap_or(args.len());
            let mut board = match &args[..split] {
                ["startpos"] => Board::starting_position(),
                ["fen", fen @ ..] if fen.len() == 6 => {
                    let Ok(board) = Board::from_fen(&fen.join(" ")) else {
                        return false;
                    };
                    board
                }
                _ => return false,
            };
            for uci in args.get(split + 1..).unwrap_or_default() {
                let moves = board.generate_all_moves();
                let Some(mv) = moves
                    .iter()
                    .map(|m| m.mv)
                    .find(|mv| board.is_legal(*mv) && mv.to_uci(&board) == *uci)
                else {
                    return false;
                };
                board.make_move(mv, &mut NullBoardObserver {});
                board.advance_fullmove_counter();
            }
            td.board = board;
        }
        ["go", kind, value] => {
            let Ok(value) = value.parse::<u64>() else {
                return false;
            };
            let limits = match *kind {
                "movetime" => Limits::Time(value.clamp(20, 5000)),
                "depth" => Limits::Depth(value.clamp(1, 64) as i32),
                _ => return false,
            };
            if !td
                .board
                .generate_all_moves()
                .iter()
                .any(|m| td.board.is_legal(m.mv))
            {
                println!("bestmove 0000");
                return true;
            }
            td.shared.tt.increment_age();
            td.shared.nodes.reset();
            td.shared.tb_hits.reset();
            td.shared.soft_stop_votes.store(0, Ordering::Release);
            td.shared.status.set(Status::RUNNING);
            for stat in &td.shared.best_stats {
                stat.store((td.previous_best_score + 32768) as u32, Ordering::Release);
            }
            td.time_manager = TimeManager::new(limits, td.board.fullmove_number(), 0);
            search::start(td, search::Report::Full, 1);
            td.shared.status.set(Status::STOPPED);
            println!("bestmove {}", td.root_moves[0].mv.to_uci(&td.board));
        }
        ["eval"] => {
            td.nnue.full_refresh(&td.board);
            println!("evaluation {}", td.nnue.evaluate(&td.board));
        }
        _ => return false,
    }
    true
}
