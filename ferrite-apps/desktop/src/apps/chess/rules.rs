//! The rules of chess, as the pages apply them (`demos/chess/chess-game.ts`,
//! ported function by function): the server replays a game's plies with
//! them and refuses a ply they refuse, so a stored game only ever holds
//! plies every page can replay.
//!
//! Kept in step with the TypeScript by hand. The perft counts in the tests
//! hold the move generation to the published numbers, and the draw rules
//! (claims, dead positions, seventy-five moves, fivefold repetition) follow
//! `gameStatus` and `drawClaim` there line for line.
//!
//! A game plays one of four variants ([`Variant`]), as `chess-game.ts` says:
//! regular chess; Crazyhouse, where a piece taken joins the taker's hand and
//! may be dropped; Losers, where captures are compulsory and losing every
//! piece but the king, or having no move, wins; and Suicide, the same with a
//! king that may be taken and no check, castling or stalemate draw.

use ferrite_app::serde;

/// The rules a game is played by.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Variant {
    Regular,
    Crazyhouse,
    Losers,
    Suicide,
}

impl Default for Variant {
    fn default() -> Self {
        Variant::Regular
    }
}

impl Variant {
    fn captures_compulsory(self) -> bool {
        matches!(self, Variant::Losers | Variant::Suicide)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    White,
    Black,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::White => Side::Black,
            Side::Black => Side::White,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    King,
    Queen,
    Rook,
    Bishop,
    Knight,
    Pawn,
}

impl Kind {
    /// A promotion as a ply names it: "queen", "rook", "bishop" or "knight".
    pub fn promotion(name: &str) -> Option<Kind> {
        match name {
            "queen" => Some(Kind::Queen),
            "rook" => Some(Kind::Rook),
            "bishop" => Some(Kind::Bishop),
            "knight" => Some(Kind::Knight),
            _ => None,
        }
    }

    /// A piece that may be dropped from the hand, by name.
    pub fn droppable(name: &str) -> Option<Kind> {
        match name {
            "pawn" => Some(Kind::Pawn),
            other => Kind::promotion(other),
        }
    }

    fn letter(self) -> char {
        match self {
            Kind::King => 'k',
            Kind::Queen => 'q',
            Kind::Rook => 'r',
            Kind::Bishop => 'b',
            Kind::Knight => 'n',
            Kind::Pawn => 'p',
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Piece {
    pub side: Side,
    pub kind: Kind,
}

/// Castling rights: white kingside, white queenside, black kingside, black
/// queenside.
type Castling = [bool; 4];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Position {
    pub variant: Variant,
    /// What each side may drop in Crazyhouse: white's, then black's.
    hands: [Vec<Kind>; 2],
    /// The squares of the pieces that were promoted.
    promoted: Vec<usize>,
    /// a1, b1, ... h8.
    pub board: [Option<Piece>; 64],
    pub turn: Side,
    castling: Castling,
    /// The square a pawn has just passed over with a double step.
    en_passant: Option<usize>,
    pub halfmove_clock: u64,
    fullmove_number: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Castle {
    Kingside,
    Queenside,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Candidate {
    /// The square it leaves; [`DROP`] for a piece dropped from the hand.
    from: usize,
    to: usize,
    /// The square of the piece taken: not `to` in a capture en passant.
    taken: Option<usize>,
    castle: Option<Castle>,
    promotion: Option<Kind>,
    drop: Option<Kind>,
}

/// The `from` of a drop, which is no square.
const DROP: usize = 64;

const KNIGHT_STEPS: [(i32, i32); 8] = [
    (1, 2),
    (2, 1),
    (2, -1),
    (1, -2),
    (-1, -2),
    (-2, -1),
    (-2, 1),
    (-1, 2),
];
const DIAGONALS: [(i32, i32); 4] = [(1, 1), (1, -1), (-1, -1), (-1, 1)];
const STRAIGHTS: [(i32, i32); 4] = [(1, 0), (0, -1), (-1, 0), (0, 1)];
const EVERY_WAY: [(i32, i32); 8] = [
    (1, 1),
    (1, -1),
    (-1, -1),
    (-1, 1),
    (1, 0),
    (0, -1),
    (-1, 0),
    (0, 1),
];
const PROMOTIONS: [Kind; 4] = [Kind::Queen, Kind::Rook, Kind::Bishop, Kind::Knight];

fn file_of(index: usize) -> i32 {
    (index % 8) as i32
}

fn rank_of(index: usize) -> i32 {
    (index / 8) as i32
}

/// The index of a square such as "e2".
pub fn square_index(square: &str) -> Option<usize> {
    match square.as_bytes() {
        [file @ b'a'..=b'h', rank @ b'1'..=b'8'] => {
            Some(usize::from(rank - b'1') * 8 + usize::from(file - b'a'))
        }
        _ => None,
    }
}

fn name_of(index: usize) -> String {
    let file = char::from(b'a' + (index % 8) as u8);
    let rank = char::from(b'1' + (index / 8) as u8);
    format!("{file}{rank}")
}

fn step(from: usize, files: i32, ranks: i32) -> Option<usize> {
    let file = file_of(from) + files;
    let rank = rank_of(from) + ranks;
    ((0..8).contains(&file) && (0..8).contains(&rank)).then(|| (rank * 8 + file) as usize)
}

fn attacked(board: &[Option<Piece>; 64], target: usize, by: Side) -> bool {
    let holds = |index: Option<usize>, kinds: &[Kind]| {
        index
            .and_then(|i| board[i])
            .is_some_and(|p| p.side == by && kinds.contains(&p.kind))
    };
    let behind = if by == Side::White { -1 } else { 1 };
    if holds(step(target, -1, behind), &[Kind::Pawn])
        || holds(step(target, 1, behind), &[Kind::Pawn])
    {
        return true;
    }
    if KNIGHT_STEPS
        .iter()
        .any(|&(f, r)| holds(step(target, f, r), &[Kind::Knight]))
    {
        return true;
    }
    if EVERY_WAY
        .iter()
        .any(|&(f, r)| holds(step(target, f, r), &[Kind::King]))
    {
        return true;
    }
    let along = |ways: &[(i32, i32)], kinds: &[Kind]| {
        for &(f, r) in ways {
            let mut square = step(target, f, r);
            while let Some(s) = square {
                if board[s].is_some() {
                    if holds(Some(s), kinds) {
                        return true;
                    }
                    break;
                }
                square = step(s, f, r);
            }
        }
        false
    };
    along(&DIAGONALS, &[Kind::Bishop, Kind::Queen]) || along(&STRAIGHTS, &[Kind::Rook, Kind::Queen])
}

fn king_of(board: &[Option<Piece>; 64], side: Side) -> Option<usize> {
    board
        .iter()
        .position(|p| p.is_some_and(|p| p.kind == Kind::King && p.side == side))
}

fn candidates(position: &Position, from: usize) -> Vec<Candidate> {
    let board = &position.board;
    let Some(piece) = board[from] else {
        return Vec::new();
    };
    let side = piece.side;
    let kings_taken = position.variant == Variant::Suicide;
    let mut found = Vec::new();
    let mut add =
        |to: usize, taken: Option<usize>, castle: Option<Castle>, promotion: Option<Kind>| {
            found.push(Candidate {
                from,
                to,
                taken,
                castle,
                promotion,
                drop: None,
            });
        };
    let travel = |ways: &[(i32, i32)], far: bool, add: &mut dyn FnMut(usize, Option<usize>)| {
        for &(f, r) in ways {
            let mut to = step(from, f, r);
            while let Some(t) = to {
                let there = board[t];
                if there.is_some_and(|p| p.side == side || (p.kind == Kind::King && !kings_taken)) {
                    break;
                }
                add(t, there.map(|_| t));
                if there.is_some() || !far {
                    break;
                }
                to = step(t, f, r);
            }
        }
    };
    match piece.kind {
        Kind::Knight => travel(&KNIGHT_STEPS, false, &mut |t, k| add(t, k, None, None)),
        Kind::Bishop => travel(&DIAGONALS, true, &mut |t, k| add(t, k, None, None)),
        Kind::Rook => travel(&STRAIGHTS, true, &mut |t, k| add(t, k, None, None)),
        Kind::Queen => travel(&EVERY_WAY, true, &mut |t, k| add(t, k, None, None)),
        Kind::King => {
            travel(&EVERY_WAY, false, &mut |t, k| add(t, k, None, None));
            let rank = if side == Side::White { 0 } else { 7 };
            let at = |file: usize| rank * 8 + file;
            if from == at(4) && !kings_taken {
                let enemy = side.opposite();
                let empty = |files: &[usize]| files.iter().all(|&f| board[at(f)].is_none());
                let safe = |files: &[usize]| files.iter().all(|&f| !attacked(board, at(f), enemy));
                let rook_on = |file: usize| {
                    board[at(file)].is_some_and(|p| p.kind == Kind::Rook && p.side == side)
                };
                let (kingside, queenside) = match side {
                    Side::White => (position.castling[0], position.castling[1]),
                    Side::Black => (position.castling[2], position.castling[3]),
                };
                if kingside && rook_on(7) && empty(&[5, 6]) && safe(&[4, 5, 6]) {
                    add(at(6), None, Some(Castle::Kingside), None);
                }
                if queenside && rook_on(0) && empty(&[1, 2, 3]) && safe(&[4, 3, 2]) {
                    add(at(2), None, Some(Castle::Queenside), None);
                }
            }
        }
        Kind::Pawn => {
            let forward = if side == Side::White { 1 } else { -1 };
            let home = if side == Side::White { 1 } else { 6 };
            let last = if side == Side::White { 7 } else { 0 };
            let mut arrive = |to: usize, taken: Option<usize>| {
                if rank_of(to) != last {
                    add(to, taken, None, None);
                } else {
                    for promotion in PROMOTIONS {
                        add(to, taken, None, Some(promotion));
                    }
                }
            };
            if let Some(one) = step(from, 0, forward).filter(|&s| board[s].is_none()) {
                arrive(one, None);
                if rank_of(from) == home {
                    if let Some(two) = step(one, 0, forward).filter(|&s| board[s].is_none()) {
                        arrive(two, None);
                    }
                }
            }
            let fifth = if side == Side::White { 4 } else { 3 };
            let passed = if rank_of(from) == fifth {
                position.en_passant
            } else {
                None
            };
            for files in [-1, 1] {
                let Some(to) = step(from, files, forward) else {
                    continue;
                };
                if let Some(there) = board[to] {
                    if there.side != side && (there.kind != Kind::King || kings_taken) {
                        arrive(to, Some(to));
                    }
                } else if Some(to) == passed {
                    let beside = step(to, 0, -forward);
                    if beside
                        .and_then(|b| board[b])
                        .is_some_and(|p| p.kind == Kind::Pawn && p.side != side)
                    {
                        arrive(to, beside);
                    }
                }
            }
        }
    }
    found
}

fn apply(position: &Position, mv: &Candidate) -> Position {
    if let Some(kind) = mv.drop {
        return apply_drop(position, mv.to, kind);
    }
    let mut board = position.board;
    let piece = board[mv.from].expect("a candidate moves a piece");
    let side = piece.side;
    let taken = mv.taken.and_then(|square| board[square]);
    board[mv.from] = None;
    if let Some(taken) = mv.taken {
        board[taken] = None;
    }
    board[mv.to] = Some(match mv.promotion {
        Some(kind) => Piece { side, kind },
        None => piece,
    });
    if let Some(castle) = mv.castle {
        let rank = (mv.from / 8) * 8;
        let (corner, beside) = match castle {
            Castle::Kingside => (7, 5),
            Castle::Queenside => (0, 3),
        };
        board[rank + beside] = board[rank + corner];
        board[rank + corner] = None;
    }
    let touches = |square: usize| mv.from == square || mv.to == square;
    let king = piece.kind == Kind::King;
    let c = position.castling;
    let castling = [
        c[0] && !(king && side == Side::White) && !touches(7),
        c[1] && !(king && side == Side::White) && !touches(0),
        c[2] && !(king && side == Side::Black) && !touches(63),
        c[3] && !(king && side == Side::Black) && !touches(56),
    ];
    let pawn = piece.kind == Kind::Pawn;
    let double_step = pawn && mv.to.abs_diff(mv.from) == 16;
    let mut hands = position.hands.clone();
    let mut promoted = position.promoted.clone();
    if position.variant == Variant::Crazyhouse {
        let was_promoted = mv.taken.is_some_and(|square| promoted.contains(&square));
        if let Some(taken) = taken {
            hands[side_index(side)].push(if was_promoted { Kind::Pawn } else { taken.kind });
        }
        let moved_promoted = promoted.contains(&mv.from);
        promoted.retain(|&square| Some(square) != mv.taken && square != mv.from);
        if mv.promotion.is_some() || moved_promoted {
            promoted.push(mv.to);
        }
    }
    Position {
        variant: position.variant,
        hands,
        promoted,
        board,
        turn: side.opposite(),
        castling,
        en_passant: double_step.then(|| (mv.from + mv.to) / 2),
        halfmove_clock: if pawn || mv.taken.is_some() {
            0
        } else {
            position.halfmove_clock.saturating_add(1)
        },
        fullmove_number: position
            .fullmove_number
            .saturating_add(u64::from(side == Side::Black)),
    }
}

fn side_index(side: Side) -> usize {
    match side {
        Side::White => 0,
        Side::Black => 1,
    }
}

/// The position after a piece is dropped from the hand of the side to move.
fn apply_drop(position: &Position, to: usize, kind: Kind) -> Position {
    let side = position.turn;
    let mut next = position.clone();
    next.board[to] = Some(Piece { side, kind });
    let hand = &mut next.hands[side_index(side)];
    if let Some(at) = hand.iter().position(|&held| held == kind) {
        hand.remove(at);
    }
    next.turn = side.opposite();
    next.en_passant = None;
    next.halfmove_clock = if kind == Kind::Pawn {
        0
    } else {
        position.halfmove_clock.saturating_add(1)
    };
    next.fullmove_number = position
        .fullmove_number
        .saturating_add(u64::from(side == Side::Black));
    next
}

/// The drops of the side to move that leave its king safe.
fn safe_drops(position: &Position) -> Vec<Candidate> {
    if position.variant != Variant::Crazyhouse {
        return Vec::new();
    }
    let mut kinds = position.hands[side_index(position.turn)].clone();
    kinds.sort_by_key(|kind| kind.letter());
    kinds.dedup();
    let mut found = Vec::new();
    for kind in kinds {
        for to in 0..64 {
            let last_rank = rank_of(to) == 0 || rank_of(to) == 7;
            if position.board[to].is_some() || (kind == Kind::Pawn && last_rank) {
                continue;
            }
            let mv = Candidate {
                from: DROP,
                to,
                taken: None,
                castle: None,
                promotion: None,
                drop: Some(kind),
            };
            let next = apply(position, &mv);
            match king_of(&next.board, position.turn) {
                Some(king) if attacked(&next.board, king, next.turn) => {}
                _ => found.push(mv),
            }
        }
    }
    found
}

/// The moves of the side to move: where captures are compulsory, only captures while it has one.
fn legal(position: &Position, only: Option<usize>) -> Vec<Candidate> {
    if position.variant.captures_compulsory() {
        let all = board_moves(position, None);
        let any_capture = all.iter().any(|mv| mv.taken.is_some());
        return all
            .into_iter()
            .filter(|mv| !any_capture || mv.taken.is_some())
            .filter(|mv| only.is_none_or(|square| mv.from == square))
            .collect();
    }
    let mut found = board_moves(position, only);
    if only.is_none() {
        found.extend(safe_drops(position));
    }
    found
}

fn board_moves(position: &Position, only: Option<usize>) -> Vec<Candidate> {
    let squares = match only {
        Some(square) => square..square + 1,
        None => 0..64,
    };
    let mut found = Vec::new();
    for from in squares {
        if position.board[from].map(|p| p.side) != Some(position.turn) {
            continue;
        }
        for mv in candidates(position, from) {
            if position.variant == Variant::Suicide {
                found.push(mv);
                continue;
            }
            let next = apply(position, &mv);
            match king_of(&next.board, position.turn) {
                Some(king) if attacked(&next.board, king, next.turn) => {}
                _ => found.push(mv),
            }
        }
    }
    found
}

fn position_key(position: &Position, en_passant: Option<usize>) -> String {
    let mut rows = Vec::with_capacity(8);
    for rank in (0..8).rev() {
        let mut row = String::new();
        let mut empty = 0;
        for file in 0..8 {
            match position.board[rank * 8 + file] {
                None => empty += 1,
                Some(piece) => {
                    if empty > 0 {
                        row.push_str(&empty.to_string());
                    }
                    empty = 0;
                    let letter = piece.kind.letter();
                    row.push(if piece.side == Side::White {
                        letter.to_ascii_uppercase()
                    } else {
                        letter
                    });
                }
            }
        }
        if empty > 0 {
            row.push_str(&empty.to_string());
        }
        rows.push(row);
    }
    let c = position.castling;
    let mut rights: String = [(c[0], 'K'), (c[1], 'Q'), (c[2], 'k'), (c[3], 'q')]
        .iter()
        .filter(|(on, _)| *on)
        .map(|(_, letter)| *letter)
        .collect();
    if rights.is_empty() {
        rights.push('-');
    }
    let turn = if position.turn == Side::White {
        'w'
    } else {
        'b'
    };
    let passed = en_passant.map_or_else(|| "-".to_string(), name_of);
    let held = if position.variant == Variant::Crazyhouse {
        let hand = |side: Side| {
            let mut letters: Vec<char> = position.hands[side_index(side)]
                .iter()
                .map(|kind| kind.letter())
                .collect();
            letters.sort_unstable();
            letters.into_iter().collect::<String>()
        };
        let mut promoted = position.promoted.clone();
        promoted.sort_unstable();
        let promoted: Vec<String> = promoted.iter().map(usize::to_string).collect();
        format!(
            " {}/{} {}",
            hand(Side::White).to_uppercase(),
            hand(Side::Black),
            promoted.join(",")
        )
    } else {
        String::new()
    };
    format!("{} {turn} {rights} {passed}{held}", rows.join("/"))
}

fn repetition_key(position: &Position) -> String {
    let open = position.en_passant.is_some()
        && legal(position, None)
            .iter()
            .any(|m| m.taken.is_some_and(|t| t != m.to));
    position_key(position, if open { position.en_passant } else { None })
}

fn insufficient_material(board: &[Option<Piece>; 64]) -> bool {
    let mut others = Vec::new();
    for (index, piece) in board.iter().enumerate() {
        if let Some(piece) = piece {
            if piece.kind != Kind::King {
                if piece.kind != Kind::Bishop && piece.kind != Kind::Knight {
                    return false;
                }
                others.push(index);
            }
        }
    }
    if others.len() <= 1 {
        return true;
    }
    let shade = |index: usize| (file_of(index) + rank_of(index)) % 2;
    let first = shade(others[0]);
    others
        .iter()
        .all(|&i| board[i].is_some_and(|p| p.kind == Kind::Bishop) && shade(i) == first)
}

fn pawn_locked(position: &Position) -> bool {
    let board = &position.board;
    let mut pawns = 0;
    for (index, piece) in board.iter().enumerate() {
        let Some(piece) = piece else { continue };
        if piece.kind == Kind::King {
            continue;
        }
        if piece.kind != Kind::Pawn {
            return false;
        }
        pawns += 1;
        let ahead = step(index, 0, if piece.side == Side::White { 1 } else { -1 });
        let blocked = ahead
            .and_then(|a| board[a])
            .is_some_and(|b| b.kind == Kind::Pawn && b.side != piece.side);
        if !blocked {
            return false;
        }
    }
    if pawns == 0 {
        return false;
    }
    if legal(position, None).iter().any(|m| m.taken.is_some()) {
        return false;
    }
    let other = Position {
        turn: position.turn.opposite(),
        en_passant: None,
        ..position.clone()
    };
    if legal(&other, None).iter().any(|m| m.taken.is_some()) {
        return false;
    }
    let pawn_attacks = |target: usize, by: Side| {
        let behind = if by == Side::White { -1 } else { 1 };
        [step(target, -1, behind), step(target, 1, behind)]
            .iter()
            .any(|i| {
                i.and_then(|i| board[i])
                    .is_some_and(|p| p.kind == Kind::Pawn && p.side == by)
            })
    };
    for side in [Side::White, Side::Black] {
        let Some(start) = king_of(board, side) else {
            return false;
        };
        let enemy = side.opposite();
        let mut seen = vec![start];
        let mut queue = vec![start];
        while let Some(from) = queue.pop() {
            for &(f, r) in &EVERY_WAY {
                let Some(to) = step(from, f, r) else { continue };
                if seen.contains(&to) {
                    continue;
                }
                let there = board[to];
                if there.is_some_and(|p| p.kind == Kind::Pawn && p.side == side) {
                    continue;
                }
                if pawn_attacks(to, enemy) {
                    continue;
                }
                if there.is_some_and(|p| p.kind == Kind::Pawn) {
                    return false;
                }
                seen.push(to);
                queue.push(to);
            }
        }
    }
    true
}

fn dead_position(position: &Position) -> bool {
    // A piece in hand, or a king that may be taken or wants to be, can still change the game.
    position.variant == Variant::Regular
        && (insufficient_material(&position.board) || pawn_locked(position))
}

/// A draw the side to move may claim.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Claim {
    FiftyMoves,
    Repetition,
}

/// How a game stands on the board ([`Game::outcome`]).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Playing,
    /// Won by the side named.
    Checkmate(Side),
    /// A Losers or Suicide game, won by the side that lost all it could.
    Won(Side),
    Draw,
}

/// A game: the position, every position it has been in, and a claimed draw.
#[derive(Clone, Debug)]
pub struct Game {
    pub position: Position,
    positions: Vec<String>,
    claimed: Option<Claim>,
}

impl Default for Game {
    fn default() -> Self {
        Game::from_position(start())
    }
}

/// The starting position.
fn start() -> Position {
    let mut board = [None; 64];
    let back = [
        Kind::Rook,
        Kind::Knight,
        Kind::Bishop,
        Kind::Queen,
        Kind::King,
        Kind::Bishop,
        Kind::Knight,
        Kind::Rook,
    ];
    for (file, kind) in back.into_iter().enumerate() {
        board[file] = Some(Piece {
            side: Side::White,
            kind,
        });
        board[8 + file] = Some(Piece {
            side: Side::White,
            kind: Kind::Pawn,
        });
        board[48 + file] = Some(Piece {
            side: Side::Black,
            kind: Kind::Pawn,
        });
        board[56 + file] = Some(Piece {
            side: Side::Black,
            kind,
        });
    }
    Position {
        variant: Variant::Regular,
        hands: [Vec::new(), Vec::new()],
        promoted: Vec::new(),
        board,
        turn: Side::White,
        castling: [true; 4],
        en_passant: None,
        halfmove_clock: 0,
        fullmove_number: 1,
    }
}

impl Game {
    /// A new game of `variant`, from the starting position.
    pub fn new(variant: Variant) -> Game {
        let mut position = start();
        position.variant = variant;
        if variant == Variant::Suicide {
            position.castling = [false; 4];
        }
        Game::from_position(position)
    }

    /// Whether the side to move has lost everything it set out to lose.
    fn nothing_left(&self) -> bool {
        let turn = self.position.turn;
        let mut left = self
            .position
            .board
            .iter()
            .flatten()
            .filter(|p| p.side == turn);
        match self.position.variant {
            Variant::Suicide => left.next().is_none(),
            Variant::Losers => left.all(|p| p.kind == Kind::King),
            _ => false,
        }
    }
    fn from_position(position: Position) -> Game {
        let key = repetition_key(&position);
        Game {
            position,
            positions: vec![key],
            claimed: None,
        }
    }

    fn occurrences(&self) -> usize {
        let now = self.positions.last();
        self.positions.iter().filter(|k| Some(*k) == now).count()
    }

    /// Whether the game is still being played: the side to move has a legal
    /// move, and no rule or claim has drawn it.
    pub fn playing(&self) -> bool {
        !self.nothing_left()
            && !legal(&self.position, None).is_empty()
            && !dead_position(&self.position)
            && self.position.halfmove_clock < 150
            && self.occurrences() < 5
            && self.claimed.is_none()
    }

    /// How the game stands on the board: still being played, won by
    /// checkmate (by the side that gave it), or drawn by a rule or a claim.
    pub fn outcome(&self) -> Outcome {
        if self.playing() {
            return Outcome::Playing;
        }
        let turn = self.position.turn;
        let no_moves = legal(&self.position, None).is_empty();
        if self.nothing_left() || (no_moves && self.position.variant.captures_compulsory()) {
            return Outcome::Won(turn);
        }
        let mated = no_moves
            && king_of(&self.position.board, turn)
                .is_some_and(|king| attacked(&self.position.board, king, turn.opposite()));
        if mated {
            Outcome::Checkmate(turn.opposite())
        } else {
            Outcome::Draw
        }
    }

    /// The draw the side to move may claim now.
    pub fn draw_claim(&self) -> Option<Claim> {
        if !self.playing() {
            return None;
        }
        if self.occurrences() >= 3 {
            return Some(Claim::Repetition);
        }
        (self.position.halfmove_clock >= 100).then_some(Claim::FiftyMoves)
    }

    /// The game drawn by the claim of the side to move, or `None` when it has
    /// none.
    pub fn claim_draw(&self) -> Option<Game> {
        let mut game = self.clone();
        game.claim_draw_here().then_some(game)
    }

    /// Draw this game by the claim of the side to move: whether it had one.
    pub fn claim_draw_here(&mut self) -> bool {
        match self.draw_claim() {
            Some(claim) => {
                self.claimed = Some(claim);
                true
            }
            None => false,
        }
    }

    /// The game after a move, or `None` when the move is not legal or the
    /// game is over. `promotion` is read only when a pawn reaches the last
    /// rank, and is a queen when not named (as `play` in the pages).
    pub fn play(&self, from: &str, to: &str, promotion: Option<&str>) -> Option<Game> {
        let mut game = self.clone();
        game.play_here(from, to, promotion).then_some(game)
    }

    /// Make a move in this game, as [`Game::play`] does: whether it was legal
    /// (an illegal move changes nothing). A replay of a whole game moves in
    /// place, so it costs a move's work for each ply, not a copy of the game.
    pub fn play_here(&mut self, from: &str, to: &str, promotion: Option<&str>) -> bool {
        if !self.playing() {
            return false;
        }
        let (Some(from), Some(target)) = (square_index(from), square_index(to)) else {
            return false;
        };
        let promotion = match promotion {
            None => Kind::Queen,
            Some(name) => match Kind::promotion(name) {
                Some(kind) => kind,
                None => return false,
            },
        };
        let moves: Vec<Candidate> = legal(&self.position, Some(from))
            .into_iter()
            .filter(|m| m.to == target)
            .collect();
        let Some(mv) = moves
            .iter()
            .find(|m| m.promotion.is_none())
            .or_else(|| moves.iter().find(|m| m.promotion == Some(promotion)))
        else {
            return false;
        };
        self.position = apply(&self.position, mv);
        // A capture or a pawn move can never be undone, so no position before
        // it can come again: only the positions since count for repetition.
        // In Crazyhouse a drop can bring a position back, so all of them count.
        if self.position.halfmove_clock == 0 && self.position.variant != Variant::Crazyhouse {
            self.positions.clear();
        }
        self.positions.push(repetition_key(&self.position));
        self.claimed = None;
        true
    }

    /// Drop a piece from the hand of the side to move: whether it was legal
    /// (an illegal drop changes nothing).
    pub fn drop_here(&mut self, name: &str, to: &str) -> bool {
        if !self.playing() {
            return false;
        }
        let (Some(kind), Some(target)) = (Kind::droppable(name), square_index(to)) else {
            return false;
        };
        let Some(mv) = legal(&self.position, None)
            .into_iter()
            .find(|m| m.drop == Some(kind) && m.to == target)
        else {
            return false;
        };
        self.position = apply(&self.position, &mv);
        self.positions.push(repetition_key(&self.position));
        self.claimed = None;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A position from the first four fields of Forsyth-Edwards Notation.
    fn fen(text: &str) -> Position {
        let fields: Vec<&str> = text.split_whitespace().collect();
        let mut board = [None; 64];
        for (from_top, row) in fields[0].split('/').enumerate() {
            let mut file = 0;
            for letter in row.chars() {
                if let Some(n) = letter.to_digit(10) {
                    file += n as usize;
                    continue;
                }
                let kind = match letter.to_ascii_lowercase() {
                    'k' => Kind::King,
                    'q' => Kind::Queen,
                    'r' => Kind::Rook,
                    'b' => Kind::Bishop,
                    'n' => Kind::Knight,
                    _ => Kind::Pawn,
                };
                let side = if letter.is_ascii_uppercase() {
                    Side::White
                } else {
                    Side::Black
                };
                board[(7 - from_top) * 8 + file] = Some(Piece { side, kind });
                file += 1;
            }
        }
        let rights = fields[2];
        Position {
            variant: Variant::Regular,
            hands: [Vec::new(), Vec::new()],
            promoted: Vec::new(),
            board,
            turn: if fields[1] == "w" {
                Side::White
            } else {
                Side::Black
            },
            castling: [
                rights.contains('K'),
                rights.contains('Q'),
                rights.contains('k'),
                rights.contains('q'),
            ],
            en_passant: square_index(fields[3]),
            halfmove_clock: fields.get(4).map_or(0, |h| h.parse().unwrap()),
            fullmove_number: 1,
        }
    }

    fn perft(position: &Position, depth: u32) -> u64 {
        if depth == 0 {
            return 1;
        }
        legal(position, None)
            .iter()
            .map(|m| perft(&apply(position, m), depth - 1))
            .sum()
    }

    fn game_of(variant: Variant, moves: &[(&str, &str)]) -> Game {
        let mut game = Game::new(variant);
        for (from, to) in moves {
            assert!(game.play_here(from, to, None), "{from}{to} is refused");
        }
        game
    }

    #[test]
    fn losers_makes_a_capture_compulsory() {
        let mut game = game_of(Variant::Losers, &[("e2", "e4"), ("d7", "d5")]);
        assert!(!game.play_here("g1", "f3", None));
        assert!(game.play_here("e4", "d5", None));
    }

    #[test]
    fn suicide_takes_a_king_and_has_no_castling() {
        let game = game_of(
            Variant::Suicide,
            &[
                ("e2", "e4"),
                ("e7", "e5"),
                ("e1", "e2"),
                ("d8", "h4"),
                ("e2", "e3"),
                ("h4", "e4"),
            ],
        );
        assert_eq!(game.outcome(), Outcome::Playing);
        let moves = legal(&game.position, None);
        assert_eq!(moves.len(), 1, "{moves:?}");
        assert_eq!(moves[0].to, square_index("e4").unwrap());
    }

    #[test]
    fn the_side_with_nothing_left_wins_losers_and_suicide() {
        let mut game = Game::new(Variant::Suicide);
        game.position = fen("8/8/8/8/8/8/P7/8 b - -");
        game.position.variant = Variant::Suicide;
        assert_eq!(game.outcome(), Outcome::Won(Side::Black));
        game.position = fen("4k3/8/8/8/8/8/P7/4K3 b - -");
        game.position.variant = Variant::Losers;
        assert_eq!(game.outcome(), Outcome::Won(Side::Black));
    }

    #[test]
    fn crazyhouse_drops_what_it_took_as_the_pages_do() {
        let mut game = game_of(
            Variant::Crazyhouse,
            &[("e2", "e4"), ("d7", "d5"), ("e4", "d5"), ("d8", "d5")],
        );
        assert_eq!(game.position.hands[0], vec![Kind::Pawn]);
        assert_eq!(game.position.hands[1], vec![Kind::Pawn]);
        assert!(!game.drop_here("pawn", "e1"), "a square that is taken");
        assert!(!game.drop_here("pawn", "a8"), "the last rank");
        assert!(!game.drop_here("queen", "e4"), "not in hand");
        assert!(game.drop_here("pawn", "e4"));
        assert!(game.position.hands[0].is_empty());
        assert_eq!(
            game.position.board[square_index("e4").unwrap()],
            Some(Piece {
                side: Side::White,
                kind: Kind::Pawn
            })
        );
        let mut regular = Game::default();
        assert!(!regular.drop_here("pawn", "e4"));
    }

    #[test]
    fn crazyhouse_gives_a_promoted_piece_back_as_a_pawn() {
        let mut game = game_of(
            Variant::Crazyhouse,
            &[
                ("a2", "a4"),
                ("b7", "b5"),
                ("a4", "b5"),
                ("a7", "a6"),
                ("b5", "a6"),
                ("c8", "b7"),
                ("a6", "b7"),
                ("h7", "h6"),
                ("b7", "a8"),
                ("h6", "h5"),
                ("a8", "b8"),
            ],
        );
        let before = game.position.hands[1].len();
        assert!(game.play_here("d8", "b8", None));
        assert_eq!(game.position.hands[1].len(), before + 1);
        assert_eq!(game.position.hands[1].last(), Some(&Kind::Pawn));
    }

    #[test]
    fn a_pawn_dropped_counts_as_a_pawn_move_and_another_piece_does_not() {
        let mut game = game_of(
            Variant::Crazyhouse,
            &[
                ("e2", "e4"),
                ("d7", "d5"),
                ("e4", "d5"),
                ("g8", "f6"),
                ("g1", "f3"),
                ("f6", "g8"),
            ],
        );
        assert_eq!(game.position.halfmove_clock, 3);
        assert!(game.drop_here("pawn", "e4"));
        assert_eq!(game.position.halfmove_clock, 0);
    }

    #[test]
    fn suicide_has_no_rights_to_castle_that_could_tell_two_positions_apart() {
        let game = game_of(
            Variant::Suicide,
            &[
                ("g1", "f3"),
                ("g8", "f6"),
                ("h1", "g1"),
                ("h8", "g8"),
                ("g1", "h1"),
                ("g8", "h8"),
                ("f3", "g1"),
                ("f6", "g8"),
            ],
        );
        assert_eq!(game.positions.first(), game.positions.last());
    }

    #[test]
    fn crazyhouse_counts_the_starting_position_among_the_repetitions() {
        let dance = [("g1", "f3"), ("g8", "f6"), ("f3", "g1"), ("f6", "g8")];
        let moves: Vec<(&str, &str)> = dance.iter().chain(dance.iter()).copied().collect();
        let game = game_of(Variant::Crazyhouse, &moves);
        assert_eq!(game.draw_claim(), Some(Claim::Repetition));
    }

    #[test]
    fn crazyhouse_tells_a_promoted_piece_from_a_native_one_in_repetition() {
        let mut promoted = Game::new(Variant::Crazyhouse).position;
        let native = promoted.clone();
        promoted.promoted.push(square_index("d1").unwrap());
        assert_ne!(repetition_key(&promoted), repetition_key(&native));
    }

    #[test]
    fn move_generation_matches_the_published_perft_counts() {
        assert_eq!(perft(&start(), 1), 20);
        assert_eq!(perft(&start(), 3), 8_902);
        // "Kiwipete": castling, en passant, promotion and pins.
        let kiwipete = fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -");
        assert_eq!(perft(&kiwipete, 1), 48);
        assert_eq!(perft(&kiwipete, 2), 2_039);
        assert_eq!(perft(&kiwipete, 3), 97_862);
        // Position 3 of the Chess Programming Wiki: en passant pins on a rank.
        let third = fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -");
        assert_eq!(perft(&third, 4), 43_238);
    }

    fn moves(game: &Game, plies: &[(&str, &str)]) -> Option<Game> {
        plies
            .iter()
            .try_fold(game.clone(), |g, (from, to)| g.play(from, to, None))
    }

    #[test]
    fn an_illegal_move_is_refused() {
        let game = Game::default();
        assert!(
            game.play("e2", "e5", None).is_none(),
            "a pawn steps one or two"
        );
        assert!(game.play("e7", "e5", None).is_none(), "White moves first");
        assert!(
            game.play("d1", "d5", None).is_none(),
            "the queen is blocked"
        );
        assert!(
            game.play("e3", "e4", None).is_none(),
            "nothing stands on e3"
        );
        assert!(game.play("g1", "f3", None).is_some());
    }

    #[test]
    fn the_outcome_names_the_winner_of_a_checkmate() {
        assert_eq!(Game::default().outcome(), Outcome::Playing);
        let mated = moves(
            &Game::default(),
            &[("f2", "f3"), ("e7", "e5"), ("g2", "g4"), ("d8", "h4")],
        )
        .expect("fool's mate is legal");
        assert_eq!(mated.outcome(), Outcome::Checkmate(Side::Black));
    }

    #[test]
    fn checkmate_ends_the_game() {
        let mated = moves(
            &Game::default(),
            &[("f2", "f3"), ("e7", "e5"), ("g2", "g4"), ("d8", "h4")],
        )
        .unwrap();
        assert!(!mated.playing());
        assert!(mated.play("a2", "a3", None).is_none());
        assert!(mated.claim_draw().is_none());
    }

    #[test]
    fn a_draw_is_claimed_only_when_the_rules_allow_it() {
        let game = Game::default();
        assert!(game.claim_draw().is_none(), "nothing to claim at the start");
        let shuffle = [("g1", "f3"), ("g8", "f6"), ("f3", "g1"), ("f6", "g8")];
        let twice = moves(&game, &shuffle).unwrap();
        assert!(
            twice.claim_draw().is_none(),
            "the start stands for the second time"
        );
        let thrice = moves(&twice, &shuffle).unwrap();
        assert_eq!(thrice.draw_claim(), Some(Claim::Repetition));
        let drawn = thrice.claim_draw().unwrap();
        assert!(!drawn.playing());
        assert!(drawn.play("e2", "e4", None).is_none());

        let fifty = Game::from_position(fen("4k3/8/8/8/8/8/8/R3K3 w - - 100"));
        assert_eq!(fifty.draw_claim(), Some(Claim::FiftyMoves));
    }

    #[test]
    fn promotion_takes_the_named_piece_or_a_queen() {
        let game = Game::from_position(fen("8/P6k/8/8/8/8/8/K7 w - -"));
        let knight = game.play("a7", "a8", Some("knight")).unwrap();
        assert_eq!(knight.position.board[56].unwrap().kind, Kind::Knight);
        let queen = game.play("a7", "a8", None).unwrap();
        assert_eq!(queen.position.board[56].unwrap().kind, Kind::Queen);
        assert!(game.play("a7", "a8", Some("king")).is_none());
    }

    #[test]
    fn castling_and_en_passant_are_moves() {
        let castled = moves(
            &Game::default(),
            &[
                ("e2", "e4"),
                ("e7", "e5"),
                ("g1", "f3"),
                ("b8", "c6"),
                ("f1", "c4"),
                ("g8", "f6"),
                ("e1", "g1"),
            ],
        )
        .unwrap();
        assert_eq!(castled.position.board[5].unwrap().kind, Kind::Rook);
        let passant = moves(
            &Game::default(),
            &[
                ("e2", "e4"),
                ("a7", "a6"),
                ("e4", "e5"),
                ("d7", "d5"),
                ("e5", "d6"),
            ],
        )
        .unwrap();
        assert!(passant.position.board[square_index("d5").unwrap()].is_none());
    }
}
