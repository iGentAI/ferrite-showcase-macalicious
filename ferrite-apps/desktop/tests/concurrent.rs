use crate::support;

#[tokio::test]
async fn a_pending_operation_does_not_block_its_peer() {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let (received, sent) = support::join(async { receiver.await.unwrap() }, async {
        sender.send(42).unwrap();
        "sent"
    })
    .await;
    assert_eq!((received, sent), (42, "sent"));
}

#[tokio::test]
async fn a_completed_operation_is_not_polled_again_while_its_peer_waits() {
    let mut calls = 0;
    let first = std::future::poll_fn(|_| {
        calls += 1;
        assert_eq!(calls, 1);
        std::task::Poll::Ready(7)
    });
    let second = async {
        tokio::task::yield_now().await;
        9
    };
    assert_eq!(support::join(first, second).await, (7, 9));
}
